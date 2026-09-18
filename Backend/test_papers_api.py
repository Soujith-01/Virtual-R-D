import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("--- 1. Testing GET /papers/search ---")
res = client.get("/papers/search?query=reaction+yield+optimization+machine+learning&limit=3")
print("Search status:", res.status_code)
assert res.status_code == 200, res.text
data = res.json()
print("Search source:", data.get("source"))
print("Search count:", data.get("count"))
assert len(data.get("papers", [])) > 0, "Expected at least 1 paper"
first_paper = data["papers"][0]
print("First paper title:", first_paper.get("title"))
print("First paper authors:", first_paper.get("authors"))
print("First paper year:", first_paper.get("year"))
print("First paper doi:", first_paper.get("doi"))
print("First paper OA:", first_paper.get("is_open_access"))

print("\n--- 2. Testing POST /papers/summarize ---")
res = client.post("/papers/summarize", json={
    "paper_id": first_paper.get("paper_id"),
    "title": first_paper.get("title"),
    "authors": first_paper.get("authors"),
    "abstract": first_paper.get("abstract"),
    "research_objective": "Maximize reaction yield while minimizing reaction time"
})
print("Summarize status:", res.status_code)
assert res.status_code == 200, res.text
summary = res.json()
print("Problem:", summary.get("problem")[:60], "...")
print("Method:", summary.get("method")[:60], "...")
print("Relevance:", summary.get("relevance")[:60], "...")
print("Note:", summary.get("note"))

print("\n--- 3. Testing Library: save, list, delete ---")
# Save
res = client.post("/papers/library", json=first_paper)
print("Save status:", res.status_code)
assert res.status_code == 200, res.text

# List
res = client.get("/papers/library")
print("List status:", res.status_code)
assert res.status_code == 200, res.text
lib_papers = res.json().get("papers", [])
print(f"Library count: {len(lib_papers)}")
assert any(p.get("title") == first_paper.get("title") for p in lib_papers), "Saved paper not in library"

# Delete
res = client.delete(f"/papers/library/{first_paper.get('paper_id')}")
print("Delete status:", res.status_code)
assert res.status_code == 200, res.text

print("\n--- 4. Testing POST /research with selected papers ---")
res = client.post("/research", json={
    "research_question": "Maximize reaction yield with machine learning",
    "num_experiments": 2,
    "domain": "reaction_yield",
    "papers": [first_paper],
})
print("Research with papers status:", res.status_code)
assert res.status_code == 200, res.text
rdata = res.json()
print("Retrieved knowledge passages:", len(rdata.get("retrieved_knowledge", [])))
print("Relevant papers returned:", len(rdata.get("relevant_papers", [])))
assert len(rdata.get("relevant_papers", [])) == 1, "Expected 1 relevant paper returned"
print("First knowledge source:", rdata.get("retrieved_knowledge", [{}])[0].get("source"))

print("\nALL PAPERS BACKEND TESTS PASSED!")
