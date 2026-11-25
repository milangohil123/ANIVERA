with open('backend/app/modules/campaigns/service.py', encoding='utf-8') as f:
    text = f.read()

import ast

with open('backend/app/modules/campaigns/endpoints.py', encoding='utf-8') as f:
    endpoints_text = f.read()

print("=== Endpoints in campaigns/endpoints.py ===")
for line in endpoints_text.splitlines():
    if line.strip().startswith('@router.'):
        print(line.strip())

with open('backend/app/modules/campaigns/schemas.py', encoding='utf-8') as f:
    schemas_text = f.read()

print("\n=== Classes in campaigns/schemas.py ===")
for line in schemas_text.splitlines():
    if line.strip().startswith('class ') and '(' in line:
        print(line.strip()[:80])
