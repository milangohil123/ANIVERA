# PashuRakshak Botad — File Storage Directory

This directory manages local file storage artifacts for development and local testing.

## Subdirectories (Managed at Runtime)

- `storage/uploads/` — Uploaded attachments (disease report photos, diagnostic evidence).
- `storage/imports/` — Uploaded Excel/CSV animal and farmer batch imports.
- `storage/labels/`  — Generated QR label printable PDF batches.
- `storage/exports/` — Authorised generated data export files.
- `storage/temp/`    — Temporary processing cache.

> **Security Note:** Files stored here must be served through authenticated, scoped FastAPI endpoints with content-type and formula-injection guards. Never serve uploads as a public static directory.

