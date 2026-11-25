with open('frontend/src/views/taho/TahoStaffView.tsx', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines, 1):
    if any(k in line.lower() for k in ['village', 'assign', 'select', 'modal', 'multiple', 'radio']):
        print(f'{i}: {line.strip()[:110]}')
