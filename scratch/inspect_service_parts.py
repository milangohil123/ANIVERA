with open('backend/app/modules/campaigns/service.py', encoding='utf-8') as f:
    lines = f.readlines()

def print_range(start, end):
    for i in range(start, min(end, len(lines))):
        print(f"{i+1}: {lines[i]}", end="")

print("=== LINES 320 to 380 (create_campaign assignments) ===")
print_range(320, 380)

print("\n=== LINES 1500 to 1600 (assign_worker) ===")
print_range(1500, 1600)

print("\n=== LINES 1740 to 1830 (list_my_vo_campaign_assignments) ===")
print_range(1740, 1830)
