import re, os

def search_file(path, keywords):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        for i, line in enumerate(f, 1):
            if any(k.lower() in line.lower() for k in keywords):
                print(f"{path}:{i}: {line.strip()[:120]}")

print("=== TAHO SERVICE ===")
search_file("backend/app/modules/administration/taho_service.py", ["assign_village", "create_vo", "create_fw", "assign_vo", "assign_fw", "limit", "one village", "single village", "already assigned"])

print("\n=== CAMPAIGN SERVICE ===")
search_file("backend/app/modules/campaigns/service.py", ["assign", "campaignassignment", "status", "complete", "verify", "verification"])

print("\n=== CAMPAIGN ENDPOINTS ===")
search_file("backend/app/modules/campaigns/endpoints.py", ["assign", "complete", "verify", "verification", "status"])

print("\n=== FRONTEND TAHO ===")
for root, dirs, files in os.walk("frontend/src/views"):
    for file in files:
        if "taho" in file.lower() or "campaign" in file.lower() or "fw" in file.lower() or "vo" in file.lower():
            p = os.path.join(root, file)
            search_file(p, ["assign", "submit", "verify", "multiselect", "single"])
