"""
Phase 8 (part) - Text embeddings with a graceful fallback.

Two interchangeable backends, selected automatically:

* ``sentence-transformers`` - semantic embeddings (preferred when installed).
* ``tfidf`` - scikit-learn TF-IDF vectors, L2-normalised so inner product is
  cosine similarity. Lexical rather than semantic, but it needs no model
  download, works completely offline, and is plenty for a handful of documents.

Both produce **L2-normalised float32 vectors**, so the retriever can use a single
dot-product code path regardless of backend.

Install the semantic backend with:  pip install -r requirements-rag.txt
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import List, Sequence

import joblib
import numpy as np

from config import settings

logger = logging.getLogger("virtual_rd_lab.embeddings")

VALID_BACKENDS = ("auto", "sentence-transformers", "tfidf")


class EmbeddingsUnavailableError(RuntimeError):
    """Raised when no embedding backend can be initialised."""


def _l2_normalise(matrix: np.ndarray) -> np.ndarray:
    """Row-wise L2 normalisation; zero rows are left at zero."""
    matrix = np.asarray(matrix, dtype=np.float32)
    if matrix.ndim == 1:
        matrix = matrix.reshape(1, -1)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0.0] = 1.0
    return (matrix / norms).astype(np.float32)


class Embedder:
    """Text -> vector encoder with a swappable backend."""

    def __init__(
        self,
        backend: str | None = None,
        model_name: str | None = None,
        *,
        allow_fallback: bool = True,
    ) -> None:
        requested = (backend or settings.embedding_backend or "auto").lower()
        if requested not in VALID_BACKENDS:
            raise ValueError(f"unknown embedding backend {requested!r}; expected one of {VALID_BACKENDS}")

        self.model_name = model_name or settings.embedding_model
        self._model = None
        self._vectorizer = None
        self._dimension = 0
        self.backend = "tfidf"
        self.fallback_reason: str | None = None

        if requested in ("auto", "sentence-transformers"):
            if self._try_sentence_transformers():
                return
            if requested == "sentence-transformers" and not allow_fallback:
                raise EmbeddingsUnavailableError("sentence-transformers backend requested but unavailable")

        # --- TF-IDF fallback ------------------------------------------------ #
        self.backend = "tfidf"
        self._vectorizer = None

    # ------------------------------------------------------------------ #
    # backend construction
    # ------------------------------------------------------------------ #
    def _try_sentence_transformers(self) -> bool:
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore
        except Exception as error:  # noqa: BLE001
            self.fallback_reason = f"sentence-transformers not importable ({type(error).__name__})"
            logger.info("Falling back to TF-IDF embeddings: %s", self.fallback_reason)
            return False

        try:
            self._model = SentenceTransformer(self.model_name)
            self._dimension = int(self._model.get_sentence_embedding_dimension())
            self.backend = "sentence-transformers"
            logger.info("Embedding backend: sentence-transformers (%s)", self.model_name)
            return True
        except Exception as error:  # noqa: BLE001 - offline / no cache
            self.fallback_reason = (
                f"could not load SentenceTransformer({self.model_name!r}) ({type(error).__name__}: {error})"
            )
            logger.warning("Falling back to TF-IDF embeddings: %s", self.fallback_reason)
            self._model = None
            return False

    def _ensure_vectorizer(self) -> None:
        if self._vectorizer is None:
            from sklearn.feature_extraction.text import TfidfVectorizer

            self._vectorizer = TfidfVectorizer(
                lowercase=True,
                stop_words="english",
                ngram_range=(1, 2),
                sublinear_tf=True,
                min_df=1,
                max_features=20_000,
            )

    # ------------------------------------------------------------------ #
    # encoding
    # ------------------------------------------------------------------ #
    @property
    def dimension(self) -> int:
        if self.backend == "sentence-transformers" and self._model is not None:
            return int(self._model.get_sentence_embedding_dimension())
        if self._vectorizer is not None and hasattr(self._vectorizer, "vocabulary_"):
            return int(len(self._vectorizer.vocabulary_))
        return self._dimension

    @property
    def is_fitted(self) -> bool:
        if self.backend == "sentence-transformers":
            return self._model is not None
        return self._vectorizer is not None and hasattr(self._vectorizer, "vocabulary_")

    @property
    def description(self) -> str:
        if self.backend == "sentence-transformers":
            return f"sentence-transformers/{self.model_name}"
        return "tfidf-ngram(1,2)-l2" + (f" [fallback: {self.fallback_reason}]" if self.fallback_reason else "")

    def fit(self, texts: Sequence[str]) -> "Embedder":
        """Fit the lexical backend (no-op for sentence-transformers)."""
        if self.backend == "tfidf":
            self._ensure_vectorizer()
            assert self._vectorizer is not None
            self._vectorizer.fit(list(texts))
            self._dimension = self.dimension
        return self

    def encode(self, texts: Sequence[str], *, fit: bool = False) -> np.ndarray:
        """Encode texts into L2-normalised float32 vectors."""
        texts = list(texts)
        if not texts:
            return np.zeros((0, 0), dtype=np.float32)

        if self.backend == "sentence-transformers" and self._model is not None:
            vectors = self._model.encode(
                texts,
                normalize_embeddings=True,
                convert_to_numpy=True,
                show_progress_bar=False,
            )
            return _l2_normalise(np.asarray(vectors))

        # --- TF-IDF --------------------------------------------------------- #
        if fit or not self.is_fitted:
            self.fit(texts)
        assert self._vectorizer is not None
        matrix = self._vectorizer.transform(texts)
        return _l2_normalise(matrix.toarray())

    # ------------------------------------------------------------------ #
    # persistence
    # ------------------------------------------------------------------ #
    def save(self, path: str | Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {
                "backend": self.backend,
                "model_name": self.model_name,
                "vectorizer": self._vectorizer,
                "dimension": self.dimension,
                "fallback_reason": self.fallback_reason,
            },
            path,
        )

    @classmethod
    def load(cls, path: str | Path) -> "Embedder":
        """Restore a fitted embedder from disk."""
        payload = joblib.load(path)
        embedder = cls.__new__(cls)
        embedder.model_name = payload.get("model_name") or settings.embedding_model
        embedder._dimension = int(payload.get("dimension") or 0)
        embedder.fallback_reason = payload.get("fallback_reason")
        embedder._vectorizer = payload.get("vectorizer")
        embedder._model = None

        if payload.get("backend") == "sentence-transformers":
            if not embedder._try_sentence_transformers():
                # Semantic model vanished between runs - rebuild lexically.
                logger.warning(
                    "Saved sentence-transformers embedder unavailable; rebuilding a TF-IDF embedder "
                    "(the retrieval index will be rebuilt)."
                )
                embedder.backend = "tfidf"
                embedder._vectorizer = payload.get("vectorizer")
        else:
            embedder.backend = "tfidf"

        embedder._dimension = embedder.dimension or embedder._dimension
        return embedder


def build_embedder(backend: str | None = None, model_name: str | None = None) -> Embedder:
    """Factory used across the RAG layer."""
    return Embedder(backend=backend, model_name=model_name)
