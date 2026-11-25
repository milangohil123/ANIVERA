import os, re

def find_in_files(dir_path, patterns):
    for root, dirs, files in os.walk(dir_path):
        for f in files:
            if f.endswith(('.tsx', '.ts')):
                p = os.path.join(root, f)
                with open(p, 'r', encoding='utf-8', errors='ignore') as fp:
                    content = fp.read()
                    for pattern in patterns:
                        if re.search(pattern, content, re.IGNORECASE):
                            print(f"{p} matches {pattern}")
                            break

print("=== Search frontend for staff and village assignment ===")
find_in_files("frontend/src", [
    r"village_id.*select",
    r"assigned_villages",
    r"village_ids",
    r"assign.*village",
    r"campaign.*assign",
    r"CampaignAssignment"
])
