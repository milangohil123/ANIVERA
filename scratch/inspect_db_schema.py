import os, re

for root, dirs, files in os.walk("backend/alembic"):
    for f in files:
        if f.endswith('.py'):
            p = os.path.join(root, f)
            with open(p, 'r', encoding='utf-8', errors='ignore') as fp:
                c = fp.read()
                if "campaign_assignments" in c or "campaign_villages" in c:
                    print(f"Found in {p}")
                    for line in c.splitlines():
                        if any(k in line for k in ["campaign_assignments", "Column(", "sa.Column"]):
                            print("  ", line.strip()[:100])
