"""
Test script for authentication and admin approval endpoints.
"""

import sys
import time
import requests

API_URL = "http://127.0.0.1:8000"

def run_tests():
    print("Testing backend health...")
    r = requests.get(f"{API_URL}/health", timeout=10)
    assert r.status_code == 200, f"Health failed: {r.text}"
    print("  PASS health")

    # 1. Admin login with seeded credentials
    print("Testing admin login...")
    r = requests.post(f"{API_URL}/api/auth/login", json={
        "email": "admin@nucleus.ai",
        "password": "AdminNucleus2026!"
    })
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    admin_data = r.json()
    admin_token = admin_data["access_token"]
    assert admin_data["user"]["role"] == "admin"
    assert admin_data["user"]["status"] == "approved"
    print("  PASS admin login successful")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Register new researcher
    test_email = f"test_researcher_{int(time.time())}@lab.org"
    print(f"Registering new researcher {test_email}...")
    r = requests.post(f"{API_URL}/api/auth/register", json={
        "full_name": "Dr. Marie Curie",
        "email": test_email,
        "password": "DiscoveryPassword123!",
        "confirm_password": "DiscoveryPassword123!",
        "organization": "Radium Institute",
        "research_domain": "Reaction Yield Optimization"
    })
    assert r.status_code == 200, f"Registration failed: {r.status_code} {r.text}"
    reg_data = r.json()
    assert reg_data["status"] == "pending"
    researcher_id = reg_data["user"]["id"]
    print("  PASS researcher registered with pending status")

    # 3. Researcher tries to login before approval -> MUST FAIL with 403
    print("Testing login with pending researcher account...")
    r = requests.post(f"{API_URL}/api/auth/login", json={
        "email": test_email,
        "password": "DiscoveryPassword123!"
    })
    assert r.status_code == 403, f"Expected 403 for pending account, got {r.status_code}"
    assert "waiting for administrator approval" in r.json()["detail"].lower()
    print("  PASS pending researcher blocked with 403")

    # 4. Admin lists users and verifies pending count
    print("Testing admin list users...")
    r = requests.get(f"{API_URL}/api/admin/users", headers=admin_headers)
    assert r.status_code == 200, f"Admin list users failed: {r.text}"
    users_data = r.json()
    assert users_data["counts"]["pending"] >= 1
    found = any(u["id"] == researcher_id for u in users_data["users"])
    assert found, "Registered researcher not in admin list"
    print("  PASS admin sees pending researcher")

    # 5. Non-admin or unauthenticated cannot access /api/admin/users
    print("Testing unauthorized access to admin endpoint...")
    r = requests.get(f"{API_URL}/api/admin/users")
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print("  PASS unauthenticated blocked from admin endpoint")

    # 6. Admin approves researcher
    print(f"Admin approving researcher {researcher_id}...")
    r = requests.post(f"{API_URL}/api/admin/users/{researcher_id}/approve", headers=admin_headers)
    assert r.status_code == 200, f"Approval failed: {r.text}"
    assert r.json()["user"]["status"] == "approved"
    print("  PASS researcher approved")

    # 7. Researcher logs in after approval -> MUST SUCCEED with 200 + JWT
    print("Testing login with approved researcher...")
    r = requests.post(f"{API_URL}/api/auth/login", json={
        "email": test_email,
        "password": "DiscoveryPassword123!"
    })
    assert r.status_code == 200, f"Login failed for approved researcher: {r.text}"
    res_data = r.json()
    res_token = res_data["access_token"]
    assert res_data["user"]["status"] == "approved"
    print("  PASS approved researcher logged in with token")

    res_headers = {"Authorization": f"Bearer {res_token}"}

    # 8. Researcher checks /api/auth/me
    print("Testing /api/auth/me...")
    r = requests.get(f"{API_URL}/api/auth/me", headers=res_headers)
    assert r.status_code == 200, f"/me failed: {r.text}"
    assert r.json()["email"] == test_email
    print("  PASS /api/auth/me returns profile")

    # 9. Researcher cannot access admin endpoints
    print("Testing researcher accessing admin endpoint...")
    r = requests.get(f"{API_URL}/api/admin/users", headers=res_headers)
    assert r.status_code == 403, f"Expected 403 for non-admin, got {r.status_code}"
    print("  PASS non-admin researcher blocked with 403")

    # 10. Admin suspends researcher
    print(f"Admin suspending researcher {researcher_id}...")
    r = requests.post(f"{API_URL}/api/admin/users/{researcher_id}/suspend", headers=admin_headers)
    assert r.status_code == 200
    print("  PASS researcher suspended")

    # 11. Suspended researcher tries to login -> MUST FAIL with 403
    print("Testing login with suspended researcher...")
    r = requests.post(f"{API_URL}/api/auth/login", json={
        "email": test_email,
        "password": "DiscoveryPassword123!"
    })
    assert r.status_code == 403
    assert "suspended" in r.json()["detail"].lower()
    print("  PASS suspended researcher blocked from login")

    # 12. Admin reactivates researcher
    print(f"Admin reactivating researcher {researcher_id}...")
    r = requests.post(f"{API_URL}/api/admin/users/{researcher_id}/reactivate", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["user"]["status"] == "approved"
    print("  PASS researcher reactivated")

    # 13. Admin deletes test researcher
    print(f"Admin deleting test researcher {researcher_id}...")
    r = requests.delete(f"{API_URL}/api/admin/users/{researcher_id}", headers=admin_headers)
    assert r.status_code == 200
    print("  PASS researcher deleted")

    print("\nALL 13 BACKEND AUTH AND ADMIN TESTS PASSED!")

if __name__ == "__main__":
    run_tests()
