import os, re

keywords = [
    "already assigned",
    "one village",
    "single village",
    "cannot assign",
    "max_villages",
    "maximum",
    "limit",
    "already has",
    "duplicate",
    "ended_at.is_(None)",
    "active_assignment",
    "conflict",
    "assigned_by"
]

print("=== Checking UserVillageAssignment creation across backend ===")
for root, dirs, files in os.walk("backend/app"):
    for f in files:
        if f.endswith('.py'):
            p = os.path.join(root, f)
            with open(p, 'r', encoding='utf-8', errors='ignore') as fp:
                lines = fp.readlines()
            for i, line in enumerate(lines):
                if "UserVillageAssignment" in line or "assign_village" in line or "assign_worker" in line:
                    # check surrounding 15 lines
                    window = lines[max(0, i-5):min(len(lines), i+15)]
                    window_text = "".join(window)
                    for kw in ["already", "exist", "conflict", "limit", "count", "ended_at"]:
                        if kw in window_text.lower():
                            print(f"{p}:{i+1}: matches {kw}")
                            print("".join(window[:8]))
                            print("-" * 50)
                            break
