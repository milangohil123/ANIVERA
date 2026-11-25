with open('backend/app/modules/campaigns/service.py', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if "def assign_worker" in l:
        print(f"assign_worker is at line {i+1}")
        for j in range(i, min(i+70, len(lines))):
            print(f"{j+1}: {lines[j]}", end="")
