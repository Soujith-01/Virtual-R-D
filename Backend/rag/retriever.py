"""
Phase 8 - Lightweight RAG retriever.

Pipeline: load documents -> extract text -> chunk -> embed -> index -> retrieve.

* **Documents**: ``backend/rag/documents/`` (``.md``/``.txt`` natively, ``.pdf``
  when ``pypdf`` is installed).
* **Index**: FAISS ``IndexFlatIP`` when available, otherwise exact NumPy
  inner-product search. On a knowledge base this small, exact search is the
  correct choice anyway - it is both faster and exact.
* **Sources**: every retrieved chunk carries its source filename so the report
  can name what it used. Nothing is invented.

The index is cached under ``backend/rag/index/`` and rebuilt automatically when
the documents change or the embedding backend changes.

CLI:

    python -m rag.retriever --rebuild
    python -m rag.retriever --query "effect of temperature on selectivity"
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import sys
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Sequence

import joblib
import numpy as np

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from config import settings  # noqa: E402
from rag.embeddings import Embedder, build_embedder  # noqa: E402

logger = logging.getLogger("virtual_rd_lab.rag")

SUPPORTED_SUFFIXES = (".md", ".txt", ".markdown")


@dataclass
class Document:
    """One source document on disk."""

    source: str      # filename shown to the user
    path: str
    text: str


@dataclass
class Chunk:
    """One retrievable passage."""

    chunk_id: str
    source: str
    text: str
    index: int


# --------------------------------------------------------------------------- #
# loading
# --------------------------------------------------------------------------- #

def _extract_pdf(path: Path) -> str:
    try:
        from pypdf import PdfReader  # type: ignore
    except Exception:  # noqa: BLE001
        logger.warning("Skipping %s: pypdf is not installed (pip install -r requirements-rag.txt)", path.name)
        return ""

    try:
        reader = PdfReader(str(path))
        return "\n\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception as error:  # noqa: BLE001
        logger.warning("Could not read %s: %s", path.name, error)
        return ""


def load_documents(documents_dir: str | Path | None = None) -> List[Document]:
    """Read every supported file in the knowledge base directory."""
    directory = Path(documents_dir or settings.rag_documents_dir)
    if not directory.exists():
        logger.warning("Knowledge base directory %s does not exist", directory)
        return []

    documents: List[Document] = []
    for path in sorted(directory.rglob("*")):
        if not path.is_file():
            continue

        suffix = path.suffix.lower()
        if suffix in SUPPORTED_SUFFIXES:
            text = path.read_text(encoding="utf-8", errors="replace")
        elif suffix == ".pdf":
            text = _extract_pdf(path)
        else:
            continue

        text = text.strip()
        if not text:
            continue

        documents.append(
            Document(
                source=path.name,
                path=str(path),
                text=text,
            )
        )

    logger.info("Loaded %d knowledge base document(s) from %s", len(documents), directory)
    return documents


# --------------------------------------------------------------------------- #
# chunking
# --------------------------------------------------------------------------- #

def _split_paragraphs(text: str) -> List[str]:
    """Split on blank lines, flattening soft-wrapped lines inside a paragraph."""
    paragraphs: List[str] = []
    buffer: List[str] = []
    for line in text.splitlines():
        if line.strip():
            buffer.append(line.rstrip())
        elif buffer:
            paragraphs.append(" ".join(buffer).strip())
            buffer = []
    if buffer:
        paragraphs.append(" ".join(buffer).strip())
    return [paragraph for paragraph in paragraphs if paragraph]


def chunk_document(
    document: Document, *, chunk_size: int = 700, overlap: int = 120
) -> List[Chunk]:
    """
    Pack paragraphs into ~``chunk_size`` character windows with a tail overlap.

    Markdown headings are kept attached to the paragraph that follows them so a
    chunk never starts with a dangling list item.
    """
    paragraphs = _split_paragraphs(document.text)
    chunks: List[Chunk] = []
    current: List[str] = []
    length = 0

    def flush() -> None:
        nonlocal current, length
        if current:
            chunks.append(current[:])
        current = []
        length = 0

    for paragraph in paragraphs:
        if length and length + len(paragraph) + 1 > chunk_size:
            previous = " ".join(current)
            flush()
            if overlap > 0 and previous:
                tail = previous[-overlap:]
                current.append(tail)
                length = len(tail)
        current.append(paragraph)
        length += len(paragraph) + 1

    flush()

    return [
        Chunk(
            chunk_id=f"{document.source}#{index}",
            source=document.source,
            text=" ".join(pieces).strip(),
            index=index,
        )
        for index, pieces in enumerate(chunks)
        if " ".join(pieces).strip()
    ]


def chunk_documents(
    documents: Sequence[Document], *, chunk_size: int | None = None, overlap: int | None = None
) -> List[Chunk]:
    chunk_size = int(chunk_size or settings.chunk_size)
    overlap = int(overlap or settings.chunk_overlap)
    chunks: List[Chunk] = []
    for document in documents:
        chunks.extend(chunk_document(document, chunk_size=chunk_size, overlap=overlap))
    return chunks


# --------------------------------------------------------------------------- #
# retriever
# --------------------------------------------------------------------------- #

class Retriever:
    """Document knowledge base with a persistent vector index."""

    def __init__(
        self,
        documents_dir: str | Path | None = None,
        index_dir: str | Path | None = None,
        *,
        backend: str | None = None,
        model_name: str | None = None,
        chunk_size: int | None = None,
        overlap: int | None = None,
    ) -> None:
        self.documents_dir = Path(documents_dir or settings.rag_documents_dir)
        self.index_dir = Path(index_dir or settings.rag_index_dir)
        self.chunk_size = int(chunk_size or settings.chunk_size)
        self.overlap = int(overlap or settings.chunk_overlap)

        self._backend = backend
        self._model_name = model_name
        self._lock = threading.Lock()
        self.embedder: Embedder | None = None
        self.chunks: List[Chunk] = []
        self.vectors: np.ndarray | None = None
        self._faiss_index = None
        self.search_backend = "numpy"
        self.built_at: str | None = None
        self._ready = False

    # --- paths ---------------------------------------------------------- #
    @property
    def manifest_path(self) -> Path:
        return self.index_dir / "manifest.json"

    @property
    def chunks_path(self) -> Path:
        return self.index_dir / "chunks.json"

    @property
    def vectors_path(self) -> Path:
        return self.index_dir / "vectors.npy"

    @property
    def embedder_path(self) -> Path:
        return self.index_dir / "embedder.joblib"

    @property
    def faiss_path(self) -> Path:
        return self.index_dir / "faiss.index"

    # --- fingerprints --------------------------------------------------- #
    def document_fingerprint(self) -> str:
        digest = hashlib.sha256()
        for path in sorted(self.documents_dir.rglob("*")) if self.documents_dir.exists() else []:
            if not path.is_file() or path.suffix.lower() not in (*SUPPORTED_SUFFIXES, ".pdf"):
                continue
            stat = path.stat()
            digest.update(f"{path.name}:{stat.st_size}:{int(stat.st_mtime)}".encode("utf-8"))
        return digest.hexdigest()[:16]

    def _config_fingerprint(self) -> str:
        payload = {
            "chunk_size": self.chunk_size,
            "overlap": self.overlap,
            "backend": self._backend or settings.embedding_backend,
            "model": self._model_name or settings.embedding_model,
        }
        return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()[:16]

    # --- building ------------------------------------------------------- #
    def build(self) -> dict:
        """(Re)build the index from the documents on disk."""
        documents = load_documents(self.documents_dir)
        self.chunks = chunk_documents(documents, chunk_size=self.chunk_size, overlap=self.overlap)

        self.embedder = build_embedder(self._backend, self._model_name)

        if not self.chunks:
            logger.warning("No knowledge base chunks found in %s", self.documents_dir)
            self.vectors = np.zeros((0, self.embedder.dimension or 1), dtype=np.float32)
        else:
            self.vectors = self.embedder.encode([chunk.text for chunk in self.chunks], fit=True)

        self._build_search_index()
        self.built_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        self._ready = True
        self.save()

        stats = {
            "documents": len(documents),
            "chunks": len(self.chunks),
            "backend": self.embedder.description,
            "search": self.search_backend,
            "dimension": int(self.vectors.shape[1]) if self.vectors is not None and self.vectors.size else 0,
            "built_at": self.built_at,
        }
        logger.info("RAG index built: %s", stats)
        return stats

    def _build_search_index(self) -> None:
        """Prefer FAISS when available; exact NumPy search is the fallback."""
        self._faiss_index = None
        self.search_backend = "numpy"

        if self.vectors is None or self.vectors.size == 0:
            return

        try:
            import faiss  # type: ignore

            index = faiss.IndexFlatIP(int(self.vectors.shape[1]))
            index.add(self.vectors.astype(np.float32))
            self._faiss_index = index
            self.search_backend = "faiss"
        except Exception as error:  # noqa: BLE001
            logger.info("FAISS unavailable (%s) - using exact NumPy search", type(error).__name__)

    # --- persistence ---------------------------------------------------- #
    def save(self) -> None:
        self.index_dir.mkdir(parents=True, exist_ok=True)
        if self.embedder is not None:
            self.embedder.save(self.embedder_path)
        if self.vectors is not None:
            np.save(self.vectors_path, self.vectors)
        self.chunks_path.write_text(
            json.dumps([chunk.__dict__ for chunk in self.chunks], indent=1), encoding="utf-8"
        )
        self.manifest_path.write_text(
            json.dumps(
                {
                    "built_at": self.built_at,
                    "document_fingerprint": self.document_fingerprint(),
                    "config_fingerprint": self._config_fingerprint(),
                    "documents": sorted({chunk.source for chunk in self.chunks}),
                    "chunks": len(self.chunks),
                    "backend": self.embedder.description if self.embedder else None,
                    "search": self.search_backend,
                },
                indent=2,
            ),
            encoding="utf-8",
        )

    def _is_cache_valid(self) -> bool:
        if not (self.manifest_path.exists() and self.chunks_path.exists() and self.vectors_path.exists()):
            return False
        try:
            manifest = json.loads(self.manifest_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return False
        return (
            manifest.get("document_fingerprint") == self.document_fingerprint()
            and manifest.get("config_fingerprint") == self._config_fingerprint()
        )

    def load(self) -> bool:
        """Load a cached index. Returns False when a rebuild is required."""
        if not self._is_cache_valid():
            return False

        try:
            payload = joblib.load(self.embedder_path)
            self.embedder = Embedder.load(self.embedder_path)
            manifest = json.loads(self.manifest_path.read_text(encoding="utf-8"))

            # A backend downgrade (e.g. saved with sentence-transformers, now
            # unavailable) invalidates the stored vectors.
            if payload.get("backend") != ("sentence-transformers" if self.embedder.backend == "sentence-transformers" else "tfidf"):
                logger.info("Embedding backend changed - rebuilding the index")
                return False

            self.chunks = [Chunk(**item) for item in json.loads(self.chunks_path.read_text(encoding="utf-8"))]
            self.vectors = np.load(self.vectors_path).astype(np.float32)
            self.built_at = manifest.get("built_at")

            if self.chunks and self.vectors.shape[0] != len(self.chunks):
                logger.warning("Index/chunk count mismatch - rebuilding")
                return False

            self._build_search_index()
            self._ready = True
            return True
        except Exception as error:  # noqa: BLE001
            logger.warning("Could not load cached RAG index (%s) - rebuilding", error)
            return False

    # --- readiness ------------------------------------------------------ #
    def ensure_ready(self, *, force: bool = False) -> "Retriever":
        """Make the index queryable, building it on first use (thread-safe)."""
        if self._ready and not force:
            return self
        with self._lock:
            if self._ready and not force:
                return self
            if not force and self.load():
                return self
            self.build()
        return self

    @property
    def is_ready(self) -> bool:
        return self._ready

    def status(self) -> dict:
        sources = sorted({chunk.source for chunk in self.chunks})
        return {
            "ready": self._ready,
            "documents": len(sources),
            "document_names": sources,
            "chunks": len(self.chunks),
            "embedding_backend": self.embedder.description if self.embedder else None,
            "search_backend": self.search_backend,
            "index_built_at": self.built_at,
            "documents_dir": str(self.documents_dir),
        }

    # --- retrieval ------------------------------------------------------ #
    def retrieve(self, query: str, k: int | None = None) -> List[dict]:
        """Return the ``k`` most similar chunks with their sources and scores."""
        self.ensure_ready()
        k = int(k or settings.rag_top_k)
        query = (query or "").strip()

        if not query or not self.chunks or self.vectors is None or self.vectors.size == 0:
            return []

        query_vector = self.embedder.encode([query])  # type: ignore[union-attr]
        if query_vector.shape[1] != self.vectors.shape[1]:
            logger.warning("Embedding dimension mismatch - rebuilding the index")
            self.build()
            query_vector = self.embedder.encode([query])  # type: ignore[union-attr]

        k = max(1, min(k, len(self.chunks)))

        if self._faiss_index is not None:
            scores, indices = self._faiss_index.search(query_vector.astype(np.float32), k)
            pairs = list(zip(indices[0].tolist(), scores[0].tolist()))
        else:
            similarities = (self.vectors @ query_vector[0]).astype(np.float32)
            top = np.argsort(-similarities)[:k]
            pairs = [(int(index), float(similarities[index])) for index in top]

        results: List[dict] = []
        for index, score in pairs:
            if index < 0 or index >= len(self.chunks):
                continue
            chunk = self.chunks[index]
            results.append(
                {
                    "source": chunk.source,
                    "chunk_id": chunk.chunk_id,
                    "similarity": round(float(score), 4),
                    "text": chunk.text,
                    "characters": len(chunk.text),
                }
            )
        return results


# --------------------------------------------------------------------------- #
# module-level singleton + CLI
# --------------------------------------------------------------------------- #

retriever = Retriever()


def search(query: str, k: int | None = None) -> List[dict]:
    """Convenience wrapper around the shared retriever."""
    return retriever.retrieve(query, k=k)


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(description="Build or query the Virtual R&D Lab knowledge index.")
    parser.add_argument("--rebuild", action="store_true", help="force a full index rebuild")
    parser.add_argument("--query", type=str, default=None, help="run a retrieval query and exit")
    parser.add_argument("-k", type=int, default=None, help="number of chunks to return")
    parser.add_argument("--documents", type=Path, default=None)
    parser.add_argument("--index", type=Path, default=None)
    args = parser.parse_args(argv)

    local = Retriever(args.documents, args.index)
    if args.rebuild:
        stats = local.build()
        print(json.dumps(stats, indent=2))

    if args.query:
        local.ensure_ready()
        print(f"\nquery: {args.query}\n" + "-" * 78)
        for rank, hit in enumerate(local.retrieve(args.query, k=args.k), start=1):
            print(f"[{rank}] {hit['source']}  (cosine {hit['similarity']:.3f})")
            print(f"    {hit['text'][:260]}...\n")

    if not args.rebuild and not args.query:
        local.ensure_ready()
        print(json.dumps(local.status(), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
