"""
Integration test for the Experiment Copilot API (Phase 13).
Verifies:
1. Guardrail enforcement against off-topic queries
2. Live simulation status reasoning ("What is happening now?")
3. Apparatus instrumentation queries
4. Parameter & kinetic justifications with RAG grounding
5. Candidate selection rationale
6. Research paper grounding
7. Multi-turn conversation memory
"""

import json
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_copilot_guardrail_off_topic():
    """Unrelated questions must be blocked by the guardrail."""
    off_topic_queries = [
        "Write me a poem about summer",
        "What is the capital of France?",
        "Tell me a joke please",
        "Who is the president of the United States?",
        "Give me a recipe for chocolate cake",
    ]

    for q in off_topic_queries:
        res = client.post("/api/experiment-chat", json={"question": q, "context": {}})
        assert res.status_code == 200, f"Failed on query: {q}"
        data = res.json()
        assert data["guardrail_triggered"] is True
        assert "I am the NUCLEUS AI Experiment Copilot" in data["answer"]
        assert "I can only answer questions related to your current research and experiments." in data["answer"]
        assert len(data["sources"]) == 0


def test_copilot_simulation_status():
    """Copilot must explain the live simulation stage and action."""
    payload = {
        "question": "What is happening now in the reactor?",
        "context": {
            "page": "simulation",
            "domain": "reaction_yield",
            "experiment": {
                "temperature": 85,
                "pressure": 2.2,
                "catalyst": "B",
                "concentration": 0.25,
                "reaction_time": 30,
            },
            "simulation": {
                "stage": "HEATING",
                "current_action": "Heating the reaction mixture to 85°C...",
                "detail": "PID-controlled heating elements are ramping up temperature at 3.5°C/min.",
                "mixture_state": "Solvent and reagents homogenized; initiating thermal ramp",
                "overall_progress": 45,
            },
        },
    }

    res = client.post("/api/experiment-chat", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["guardrail_triggered"] is False
    assert "Heating the reaction mixture to 85°C" in data["answer"]
    assert "85°C" in data["answer"]
    assert any(s["type"] == "Virtual simulation" for s in data["sources"])


def test_copilot_apparatus_explanation():
    """Copilot must detail active apparatus instrumentation."""
    payload = {
        "question": "What apparatus is currently being used in this experiment?",
        "context": {
            "page": "apparatus",
            "domain": "reaction_yield",
            "current_apparatus": [
                {
                    "name": "High-Pressure Jacketed Autoclave Reactor",
                    "category": "Primary Reaction Vessel",
                    "role": "Holds reaction mixture under pressurized headspace",
                    "specs": "Rated to 35 bar @ 300°C",
                },
                {
                    "name": "Automated Catalyst Micro-Dosing Unit",
                    "category": "Metering",
                    "role": "Introduces catalyst stock solution",
                    "specs": "Precision ±0.5%",
                },
            ],
        },
    }

    res = client.post("/api/experiment-chat", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["guardrail_triggered"] is False
    assert "Autoclave Reactor" in data["answer"]
    assert any("Apparatus" in s["type"] for s in data["sources"])


def test_copilot_temperature_rag_grounding():
    """Copilot must justify temperature setting and cite RAG sources."""
    payload = {
        "question": "Why are we heating to 85°C?",
        "context": {
            "page": "simulation",
            "domain": "reaction_yield",
            "experiment": {
                "temperature": 85,
                "pressure": 2.0,
                "catalyst": "B",
            },
        },
    }

    res = client.post("/api/experiment-chat", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["guardrail_triggered"] is False
    assert "85°C" in data["answer"]
    assert any("02_temperature_effects.md" in s["title"] or s["type"] == "RAG Knowledge" for s in data["sources"])


def test_copilot_candidate_ranking_explanation():
    """Copilot must explain candidate selection and score."""
    payload = {
        "question": "Why was this experiment selected over others?",
        "context": {
            "page": "experiments",
            "domain": "reaction_yield",
            "predicted_result": {
                "predicted_yield": 86.4,
                "uncertainty_std": 1.9,
                "confidence": 0.91,
            },
            "candidate_experiments": [
                {"id": "EXP-01", "score": 0.94, "predicted_yield": 86.4, "uncertainty_std": 1.9},
                {"id": "EXP-02", "score": 0.81, "predicted_yield": 79.2, "uncertainty_std": 3.4},
            ],
        },
    }

    res = client.post("/api/experiment-chat", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["guardrail_triggered"] is False
    assert "86.4%" in data["answer"]
    assert any(s["type"] == "Model prediction" for s in data["sources"])


def test_copilot_research_paper_grounding():
    """Copilot must reference injected research papers."""
    payload = {
        "question": "Which research paper supports this experimental method?",
        "context": {
            "page": "papers",
            "domain": "reaction_yield",
            "papers": [
                {
                    "title": "Machine Learning Accelerated Catalytic Optimization",
                    "authors": ["Dr. Elena Rostova", "Dr. Marcus Vance"],
                    "year": 2024,
                    "venue": "Journal of Chemical Catalysis",
                    "doi": "10.1016/j.jcat.2024.01.012",
                }
            ],
        },
    }

    res = client.post("/api/experiment-chat", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["guardrail_triggered"] is False
    assert "Machine Learning Accelerated Catalytic Optimization" in data["answer"]
    assert any(s["type"] == "Research Paper" for s in data["sources"])


def test_copilot_conversation_history():
    """Copilot handles multi-turn conversation context."""
    payload = {
        "question": "What happens after this?",
        "context": {
            "page": "simulation",
            "domain": "reaction_yield",
            "simulation": {
                "stage": "MIXING",
                "current_action": "Mixing Reagent A, Reagent B and Catalyst B...",
                "overall_progress": 30,
            },
        },
        "history": [
            {"role": "user", "content": "What is the reactor doing right now?"},
            {"role": "assistant", "content": "The reactor is currently mixing the components."},
        ],
    }

    res = client.post("/api/experiment-chat", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["guardrail_triggered"] is False
    assert len(data["answer"]) > 20


if __name__ == "__main__":
    print("Running Copilot test suite...")
    test_copilot_guardrail_off_topic()
    print("[PASS] Guardrail tests passed")
    test_copilot_simulation_status()
    print("[PASS] Simulation status tests passed")
    test_copilot_apparatus_explanation()
    print("[PASS] Apparatus tests passed")
    test_copilot_temperature_rag_grounding()
    print("[PASS] Temperature & RAG tests passed")
    test_copilot_candidate_ranking_explanation()
    print("[PASS] Ranking tests passed")
    test_copilot_research_paper_grounding()
    print("[PASS] Research papers tests passed")
    test_copilot_conversation_history()
    print("[PASS] Conversation history tests passed")
    print("ALL 7 COPILOT TESTS PASSED!")
