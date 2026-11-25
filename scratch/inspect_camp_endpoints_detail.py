with open('backend/app/modules/campaigns/endpoints.py', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.findall(r'@router\.(get|post|put|delete|patch)\(\s*["\']([^"\']+)["\'].*?async def ([^\(\s]+)', text, re.DOTALL)
for method, path, func in matches:
    print(f"{method.upper():6} {path:40} -> {func}")
