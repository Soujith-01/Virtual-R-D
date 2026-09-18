"""
Research Papers API - Semantic Scholar search, paper summarization, and local research library.

Flow:
React -> FastAPI -> Semantic Scholar (with Europe PMC fallback on 429/network errors) -> React
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from db.store import run_store
from services.llm import llm_client

logger = logging.getLogger("virtual_rd_lab.api.papers")

router = APIRouter(tags=["Research Papers"])

SEMANTIC_SCHOLAR_SEARCH_URL = "https://api.semanticscholar.org/graph/v1/paper/search"
EUROPE_PMC_SEARCH_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"


class SummarizePaperRequest(BaseModel):
    paper_id: Optional[str] = None
    title: str = Field(..., min_length=1)
    authors: Optional[List[Any]] = None
    year: Optional[int] = None
    venue: Optional[str] = None
    abstract: Optional[str] = None
    doi: Optional[str] = None
    url: Optional[str] = None
    research_objective: Optional[str] = None


class SummarizePaperResponse(BaseModel):
    paper_id: Optional[str] = None
    title: str
    problem: str
    method: str
    data: str
    result: str
    limitation: str
    relevance: str
    is_abstract_only: bool
    context_type: str  # 'Abstract-based research context' or 'Full-text research context'
    note: str
    generated_by: str


def _search_semantic_scholar(query: str, limit: int = 10) -> Optional[List[Dict[str, Any]]]:
    """Query Semantic Scholar Academic Graph API."""
    fields = (
        "paperId,title,authors,year,venue,publicationVenue,abstract,"
        "citationCount,isOpenAccess,openAccessPdf,url,externalIds"
    )
    params = urllib.parse.urlencode({"query": query, "limit": limit, "fields": fields})
    url = f"{SEMANTIC_SCHOLAR_SEARCH_URL}?{params}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "NucleusAI-VirtualRD/1.0 (academic research tool)",
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=8) as response:
            if response.status == 200:
                payload = json.loads(response.read().decode("utf-8"))
                papers_data = payload.get("data", [])
                formatted = []
                for p in papers_data:
                    authors = [a.get("name", "") for a in p.get("authors", []) if a.get("name")]
                    venue = p.get("venue") or (p.get("publicationVenue") or {}).get("name") or ""
                    external_ids = p.get("externalIds") or {}
                    doi = external_ids.get("DOI") or ""
                    open_access_pdf = (p.get("openAccessPdf") or {}).get("url") or ""
                    is_oa = bool(p.get("isOpenAccess")) or bool(open_access_pdf)

                    paper_url = p.get("url") or (f"https://doi.org/{doi}" if doi else "")

                    formatted.append({
                        "paper_id": p.get("paperId") or doi or p.get("title", ""),
                        "title": p.get("title", "").strip(),
                        "authors": authors,
                        "year": p.get("year"),
                        "venue": venue,
                        "abstract": p.get("abstract") or "",
                        "citation_count": p.get("citationCount") or 0,
                        "doi": doi,
                        "is_open_access": is_oa,
                        "url": paper_url,
                        "open_access_pdf": open_access_pdf,
                        "source": "Semantic Scholar",
                    })
                return formatted
    except urllib.error.HTTPError as error:
        logger.warning("Semantic Scholar HTTP %s: %s", error.code, error.reason)
        return None
    except Exception as error:  # noqa: BLE001
        logger.warning("Semantic Scholar query error: %s", error)
        return None


def _search_europe_pmc(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Fallback query to Europe PMC (unrestricted open scientific repository)."""
    params = urllib.parse.urlencode({
        "query": query,
        "format": "json",
        "pageSize": limit,
        "resultType": "core",
    })
    url = f"{EUROPE_PMC_SEARCH_URL}?{params}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "NucleusAI-VirtualRD/1.0", "Accept": "application/json"},
    )

    with urllib.request.urlopen(req, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))
        results = payload.get("resultList", {}).get("result", [])
        formatted = []
        for r in results:
            author_str = r.get("authorString") or ""
            authors = [a.strip() for a in author_str.split(",") if a.strip()] if author_str else []
            doi = r.get("doi") or ""
            paper_id = r.get("id") or doi or r.get("title", "")
            paper_url = f"https://doi.org/{doi}" if doi else f"https://europepmc.org/article/{r.get('source', 'MED')}/{paper_id}"

            is_oa = r.get("isOpenAccess") == "Y"
            pdf_url = ""
            full_text_urls = r.get("fullTextUrlList", {}).get("fullTextUrl", [])
            for u in full_text_urls:
                if u.get("documentStyle") == "pdf":
                    pdf_url = u.get("url") or ""
                    break

            formatted.append({
                "paper_id": paper_id,
                "title": (r.get("title") or "Untitled paper").rstrip("."),
                "authors": authors[:8],
                "year": int(r.get("pubYear")) if r.get("pubYear") and str(r.get("pubYear")).isdigit() else None,
                "venue": r.get("journalTitle") or "",
                "abstract": r.get("abstractText") or "",
                "citation_count": int(r.get("citedByCount") or 0),
                "doi": doi,
                "is_open_access": is_oa,
                "url": paper_url,
                "open_access_pdf": pdf_url,
                "source": "Europe PMC (Semantic Scholar backup)",
            })
        return formatted


@router.get("/papers/search", summary="Search real academic papers via Semantic Scholar (with resilient fallback)")
def search_papers(
    query: str = Query(..., min_length=2, description="Search query or research topic"),
    limit: int = Query(10, ge=1, le=25, description="Max results"),
    domain: Optional[str] = Query(None, description="Optional domain context"),
) -> Dict[str, Any]:
    """Search authentic scientific literature through Semantic Scholar and Europe PMC."""
    clean_query = query.strip()
    if domain:
        clean_domain = domain.replace("-", " ").replace("_", " ")
        if clean_domain.lower() not in clean_query.lower():
            clean_query = f"{clean_query} {clean_domain}"

    papers = None
    source_used = "Semantic Scholar"

    try:
        papers = _search_semantic_scholar(clean_query, limit=limit)
    except Exception as error:  # noqa: BLE001
        logger.warning("Semantic Scholar search error: %s", error)
        papers = None

    if papers is None:
        logger.info("Falling back to Europe PMC for query: '%s'", clean_query)
        try:
            papers = _search_europe_pmc(clean_query, limit=limit)
            source_used = "Europe PMC (Semantic Scholar rate-limit fallback)"
        except Exception as error:  # noqa: BLE001
            logger.error("All academic literature search endpoints failed: %s", error)
            papers = []
            source_used = "unavailable"

    return {
        "query": clean_query,
        "count": len(papers),
        "source": source_used,
        "papers": papers,
    }


@router.post("/papers/summarize", response_model=SummarizePaperResponse, summary="Extract structured scientific findings from a paper")
def summarize_paper(payload: SummarizePaperRequest) -> SummarizePaperResponse:
    """Breakdown paper into Problem, Method, Data, Result, Limitation, and Relevance."""
    abstract = (payload.abstract or "").strip()
    has_full_text = False
    context_type = "Full-text research context" if has_full_text else "Abstract-based research context"
    note = "Summary based on the available abstract." if not has_full_text else "Summary based on full-text publication."

    authors_str = ", ".join(str(a) for a in (payload.authors or [])[:4])
    content_text = f"Title: {payload.title}\nAuthors: {authors_str}\nYear: {payload.year or 'n/a'}\nVenue: {payload.venue or 'n/a'}\nAbstract:\n{abstract or 'No abstract provided by publisher.'}"
    objective_text = payload.research_objective or "Experimental optimization and discovery"

    prompt = (
        "You are a principal scientific researcher analysing this academic paper for an R&D laboratory.\n"
        "Generate a structured summary using ONLY the verified text provided.\n"
        "Return JSON with exactly these keys:\n"
        "{\n"
        '  "problem": "Core scientific challenge addressed (1-2 sentences)",\n'
        '  "method": "Experimental, synthetic, or computational technique used (1-2 sentences)",\n'
        '  "data": "Experimental system, reagents, parameters or dataset examined (1-2 sentences)",\n'
        '  "result": "Primary quantitative or qualitative finding (1-2 sentences)",\n'
        '  "limitation": "Boundary conditions, assumptions or constraints mentioned (1-2 sentences)",\n'
        '  "relevance": "Direct practical implication for ' + objective_text + ' (1-2 sentences)"\n'
        "}\n\n"
        f"PAPER CONTENT:\n{content_text}"
    )

    parsed, result = llm_client.chat_json(
        "You are an expert scientific literature analyst. Output strictly valid JSON without preamble.",
        prompt,
    )

    if parsed and isinstance(parsed, dict) and "problem" in parsed:
        return SummarizePaperResponse(
            paper_id=payload.paper_id,
            title=payload.title,
            problem=str(parsed.get("problem", "")).strip(),
            method=str(parsed.get("method", "")).strip(),
            data=str(parsed.get("data", "")).strip(),
            result=str(parsed.get("result", "")).strip(),
            limitation=str(parsed.get("limitation", "")).strip(),
            relevance=str(parsed.get("relevance", "")).strip(),
            is_abstract_only=not has_full_text,
            context_type=context_type,
            note=note,
            generated_by=f"{result.provider}:{result.model}",
        )

    # Deterministic fallback breakdown if LLM is not configured or fails
    words = abstract.split(". ")
    first_sentence = (words[0] + ".") if len(words) > 0 and words[0] else payload.title
    second_sentence = (words[1] + ".") if len(words) > 1 else "Empirical investigation and optimization methods."
    third_sentence = (words[2] + ".") if len(words) > 2 else "Analyzed parametric variations across experimental test runs."
    fourth_sentence = (words[3] + ".") if len(words) > 3 else "Demonstrated improved performance under specified conditions."

    return SummarizePaperResponse(
        paper_id=payload.paper_id,
        title=payload.title,
        problem=f"Investigates challenges in {payload.title.lower().rstrip('.')}.",
        method=second_sentence,
        data=third_sentence,
        result=fourth_sentence,
        limitation="Conclusions reflect the specific experimental boundaries and assumptions detailed in the publication.",
        relevance=f"Informs parameter envelope bounds and variable selection for {objective_text}.",
        is_abstract_only=not has_full_text,
        context_type=context_type,
        note=note,
        generated_by="deterministic-template",
    )


@router.get("/papers/library", summary="List saved papers from local SQLite research library")
def get_library(limit: int = Query(100, ge=1, le=500)) -> Dict[str, Any]:
    """Return all papers saved in the user's research library."""
    papers = run_store.list_papers(limit=limit)
    return {
        "count": len(papers),
        "papers": papers,
    }


@router.post("/papers/library", summary="Save a paper to local SQLite research library")
def save_to_library(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Save or update a paper in the library."""
    if not payload.get("title"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Title is required")

    success = run_store.save_paper(payload)
    if not success:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save paper to database")

    return {
        "status": "saved",
        "paper_id": payload.get("paper_id") or payload.get("id"),
        "title": payload.get("title"),
    }


@router.delete("/papers/library/{paper_id}", summary="Remove a paper from local SQLite research library")
def delete_from_library(paper_id: str) -> Dict[str, Any]:
    """Delete a paper from the library."""
    success = run_store.delete_paper(paper_id)
    return {
        "status": "deleted" if success else "not_found",
        "paper_id": paper_id,
    }
