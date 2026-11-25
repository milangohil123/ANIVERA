with open('frontend/src/views/taho/TahoCampaignsView.tsx', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines, 1):
    if any(k in line.lower() for k in ['assign', 'vo', 'fw', 'worker', 'staff', 'modal', 'verify', 'submit', 'complete', 'status']):
        print(f'{i}: {line.strip()[:110]}')
