with open('backend/app/modules/authorization/service.py', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'def assert_village_scope', text)]
for idx in matches:
    print(text[idx:idx+800])
    print("="*40)
