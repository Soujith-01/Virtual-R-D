import sys
import json
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

domains = ['reaction_yield', 'solar_efficiency', 'battery_performance', 'water_purification', 'plant_growth']

test_inputs = {
    'reaction_yield': {
        'temperature': 90.0, 'pressure': 2.0, 'catalyst': 'B', 'concentration': 0.2, 'reaction_time': 45.0
    },
    'solar_efficiency': {
        'cell_thickness_nm': 180.0, 'doping_concentration': 1.0e16, 'annealing_temperature_c': 700.0, 'light_intensity_lux': 60000.0, 'operating_temperature_c': 35.0
    },
    'battery_performance': {
        'electrolyte_concentration_m': 1.2, 'charging_rate_c': 1.0, 'operating_temperature_c': 25.0, 'discharge_rate_c': 1.0, 'cycle_count': 300.0
    },
    'water_purification': {
        'coagulant_dose_mg_l': 25.0, 'ph': 7.2, 'contact_time_min': 30.0, 'temperature_c': 22.0, 'mixing_speed_rpm': 120.0
    },
    'plant_growth': {
        'light_intensity_lux': 15000.0, 'co2_concentration_ppm': 800.0, 'nutrient_concentration_mm': 1.8, 'temperature_c': 23.0, 'water_supply_ml_day': 250.0
    }
}

all_passed = True

for d in domains:
    print(f"\n=== DOMAIN: {d} ===")
    
    # 1. Design space
    r = client.get(f"/design-space?domain={d}")
    print(f"  GET /design-space: {r.status_code}")
    if r.status_code != 200:
        print("    ERROR:", r.text)
        all_passed = False

    # 2. Predict
    r = client.post("/predict", json={"domain": d, **test_inputs[d]})
    print(f"  POST /predict: {r.status_code}")
    if r.status_code != 200:
        print("    ERROR:", r.text)
        all_passed = False
    else:
        print(f"    predicted_yield: {r.json().get('predicted_yield')}")

    # 3. Generate experiments
    r = client.post("/generate-experiments", json={"domain": d, "objective": f"Maximize performance for {d}", "num_experiments": 3})
    print(f"  POST /generate-experiments: {r.status_code}")
    if r.status_code != 200:
        print("    ERROR:", r.text)
        all_passed = False
    else:
        print(f"    count: {len(r.json().get('experiments', []))}")

    # 4. Simulate
    r = client.post("/simulate", json={"domain": d, **test_inputs[d]})
    print(f"  POST /simulate: {r.status_code}")
    if r.status_code != 200:
        print("    ERROR:", r.text)
        all_passed = False
    else:
        print(f"    summary: {r.json().get('summary', '')[:60]}...")

    # 5. Research
    r = client.post("/research", json={"domain": d, "research_question": f"Find best conditions for {d}", "num_experiments": 3})
    print(f"  POST /research: {r.status_code}")
    if r.status_code != 200:
        print("    ERROR:", r.text)
        all_passed = False
    else:
        print(f"    recommended: {r.json().get('recommended_experiment', {}).get('id')}")

print("\n--- Model info & Status ---")
r = client.get("/model-info")
print(f"GET /model-info: {r.status_code}")

r = client.get("/models/status")
print(f"GET /models/status: {r.status_code}, found {r.json().get('count')} models")

for d in domains:
    r = client.get(f"/models/{d}/info")
    print(f"GET /models/{d}/info: {r.status_code}")
    if r.status_code != 200:
        all_passed = False

print(f"\nOVERALL RESULT: {'ALL PASSED' if all_passed else 'SOME FAILED'}")
