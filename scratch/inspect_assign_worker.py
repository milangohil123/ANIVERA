with open('backend/app/modules/campaigns/service.py', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(1520, min(1570, len(lines))):
    print(f"{i+1}: {lines[i]}", end="")
