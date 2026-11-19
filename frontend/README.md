# PashuRakshak Frontend PWA

**Project:** PS000195 — Digital Livestock Vaccination Tracking and Disease Early-Warning Platform (Botad)  
**Framework:** React 18 + TypeScript + Vite + Tailwind CSS + Dexie (IndexedDB) + VitePWA  
**Language:** Gujarati-only UI with Western (0-9) digits (as mandated by approved design decisions).

---

## Directory Architecture

```text
frontend/
├── src/
│   ├── app/            # App setup, React Query provider & root component
│   ├── assets/         # Static imagery, icons and styling resources
│   ├── components/     # Reusable atomic UI components (Buttons, Modals, Badges)
│   ├── layouts/        # Layout shells (Staff, Farmer, Dashboard layouts)
│   ├── pages/          # Top-level view routes
│   ├── modules/        # Feature-specific components and logic
│   ├── services/       # HTTP API clients (Axios/fetch wrappers)
│   ├── hooks/          # Custom React hooks (online status, camera, location)
│   ├── routes/         # React Router configurations & RBAC guards
│   ├── types/          # TypeScript domain models and API contracts
│   ├── utils/          # Formatting helpers (Gujarati date, number formatting)
│   ├── offline/        # Dexie.js database schema & persistent offline sync queue
│   └── i18n/           # Gujarati translation dictionaries and localization
├── public/             # Static public assets, manifest, PWA icons
├── package.json        # Dependencies & scripts
├── vite.config.ts      # Vite & PWA workbox configuration
└── README.md
```

---

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the local development server:
   ```bash
   npm run dev
   ```
3. Open in browser: `http://localhost:5173`

