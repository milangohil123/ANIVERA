# PashuRakshak Botad — Permission Correction Proposal
**Project:** PS000195 · **Date:** 31 October 2026 · **Status:** Phase 1 Architecture Proposal  
**Authoritative Baseline:** `STAKEHOLDER_PERMISSION_MATRIX.md`, `APPFLOW.md` v0.4, `DECISION_REGISTER.md` (DEC-005, DEC-006, DEC-007, DEC-011, DEC-012, DEC-031)

---

## 1. Canonical Permission Vocabulary

Per `DECISION_REGISTER.md` DEC-031, canonical permission vocabulary is established for all new implementations. The complete approved capability dictionary is defined as follows:

| Canonical Permission Code | Description / Responsibility | Required Scope | Legacy / Alias Code |
|---|---|---|---|
| `platform.admin` | Platform-level technical configuration and system administration | Global | None |
| `user.manage` | Manage user credentials, global roles, and platform status | Global | None |
| `config.manage` | Manage platform configuration, thresholds, and parameters | Global | None |
| `audit.read` | Read full append-only system audit log | Global | None |
| `audit.read_summary` | Read aggregate audit events summary | District Scope | None |
| `audit.read_own` | Read own audit trail entries | User Scope | None |
| `district.setup.manage` | District operational setup and master data coordination | Assigned District | None |
| `village.manage` | Create/update district villages and geodata | Assigned District | None |
| `gram_panchayat.manage` | Maintain GP directory and village mappings | Assigned District | None |
| `cooperative.manage` | Maintain dairy cooperative directory and village mappings | Assigned District | `coop.manage` |
| `veterinary_officer.manage` | Manage VO profiles and village assignments | Assigned District | None |
| `vaccine_stock.manage` | District vaccine stock ledger and movements | Assigned District | None |
| `campaign.configure` | Create, configure, and activate district vaccination campaigns | Assigned District | None |
| `campaign.manage` | District campaign operational management | Assigned District | None |
| `campaign.view` | View campaigns, schedules, and targets | District / Scope | None |
| `campaign.view_assigned` | View own campaign tasks and village assignments | Assigned Village | None |
| `campaign.assign_workers` | Assign Field Workers to campaigns within authorised villages | Authorised Villages | None |
| `camp.propose` | Propose vaccination camp / doorstep round | Assigned Cooperative / Village | `camp.coordinate` |
| `camp.manage` | Confirm, reschedule, or cancel camps | Authorised Villages | `camp.review` |
| `camp.view_coop` | View camps linked to own cooperative | Cooperative Scope | None |
| `camp.view_public` | View confirmed village camp dates | Village Scope | None |
| `vaccinator.manage` | Record vaccinator authorisation requests | Assigned Scope | None |
| `vaccinator.approve` | Approve vaccinator authorizations (Department reference required) | District Scope | None |
| `farmer.register` | Create farmer profile (staff-assisted only; no public signup) | Authorised Village | None |
| `farmer.verify` | In-person / staff verification of farmer identity | Authorised Village | None |
| `farmer.read` | View farmer profiles in scope | Authorised Village | None |
| `farmer.phone.view` | View farmer contact number (audited read) | Explicit Grant | `owner.phone.view` |
| `farmer.outreach` | Use consented contacts for camp outreach | Explicit Grant | `owner.outreach` |
| `farmer.account.provision` | Provision, link, or activate login credentials for existing farmer | Explicit Grant / Audit | None |
| `animal.register` | Primary animal registration in assigned village | Assigned Village (FW) | `animal.create` |
| `animal.register.fallback` | Fallback animal registration (requires FW unavailability evidence) | Authorised Village (VO) | `animal.create.fallback` |
| `animal.read` | View animal records in scope | Authorised Village | None |
| `animal.verify` | In-field / office verification of animal identity | Authorised Village | None |
| `animal.merge` | Merge duplicate animal records with audit snapshot | Authorised Village (VO) | None |
| `animal.transfer.request` | Submit animal ownership / village transfer request | Owner / Staff Scope | None |
| `animal.transfer.decide` | Approve, reject, or dispute ownership transfer | Authorised Village (VO) | None |
| `event.create` | Record routine vaccination / observation events | Assigned Village / Camp | None |
| `event.treatment.create` | Record veterinary treatment / clinical examination | Authorised Scope | None |
| `event.correct` | Amend or void an existing event fact with mandatory reason | Authorised Scope (VO) | None |
| `event.review` | Mark event as reviewed or flagged | Authorised Scope (VO) | None |
| `disease.report` | Submit suspected disease notification | Authorised Village / Farm | None |
| `disease.review` | Open, triage, and review suspected disease reports | Authorised Village (VO) | None |
| `disease.confirm` | Confirm / disprove disease report (authorised veterinary assessment) | Explicit Grant | None |
| `import.run` | Bulk import animal and farmer records | Explicit Grant | None |
| `label.generate` | Generate QR token label batch PDF | Explicit Grant / VO | None |
| `field_worker.availability.record` | Record formal FW availability / unavailability declaration | Authorised Scope | None |
| `help.create` | Create veterinary callback / help request | Any Authenticated | None |
| `help.manage` | Triage, assign, and resolve help requests | Authorised Scope | None |
| `aggregate.view` | View anonymised village aggregates | Assigned Scope | None |
| `map.view` | View surveillance / coverage map layers | Assigned Scope | None |
| `export.run` | Generate and download authorised data export | Explicit Grant | None |
| `notification.read` | Read own in-app notifications | Recipient Scope | None |
| `notification.manage` | Trigger system / campaign in-app notices | Administrative Scope | None |
| `own.read` | View own animal profiles, reminders, and history | Farmer User Scope | None |

---

## 2. Default Role Matrix vs Explicit Grants

Deny-by-default security applies. Default grants are embedded in role seeds; privileged or sensitive capabilities require explicit, audited grants in `user_permission_grants`.

| Canonical Permission Code | SYS_ADMIN | DAHO | VET_OFFICER (VO) | FIELD_WORKER (FW) | DAIRY_STAFF | GRAM_PANCHAYAT | FARMER |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `platform.admin` | **Default** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `user.manage` | **Default** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `config.manage` | **Default** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `audit.read` | **Default** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `audit.read_summary` | ❌ | **Default** | ❌ | ❌ | ❌ | ❌ | ❌ |
| `audit.read_own` | ❌ | ❌ | **Default** | ❌ | ❌ | ❌ | ❌ |
| `district.setup.manage` | ❌ | **Default** | ❌ | ❌ | ❌ | ❌ | ❌ |
| `village.manage` | ❌ | **Default** | ❌ | ❌ | ❌ | ❌ | ❌ |
| `gram_panchayat.manage` | ❌ | **Default** | ❌ | ❌ | ❌ | ❌ | ❌ |
| `cooperative.manage` | ❌ | **Default** | ❌ | ❌ | ❌ | ❌ | ❌ |
| `veterinary_officer.manage` | ❌ | **Default** | ❌ | ❌ | ❌ | ❌ | ❌ |
| `vaccine_stock.manage` | ❌ | **Default** | ❌ | ❌ | ❌ | ❌ | ❌ |
| `campaign.configure` | ❌ (Override only) | **Default** | ❌ | ❌ | ❌ | ❌ | ❌ |
| `campaign.manage` | ❌ | **Default** | ❌ | ❌ | ❌ | ❌ | ❌ |
| `campaign.view` | **Default** | **Default** | **Default** | ❌ | **Default** | **Default** | ❌ |
| `campaign.view_assigned` | ❌ | ❌ | ❌ | **Default** | ❌ | ❌ | ❌ |
| `campaign.assign_workers` | ❌ | ❌ | **Default** | ❌ | ❌ | ❌ | ❌ |
| `camp.propose` | ❌ | ❌ | ❌ | ❌ | **Default** | ❌ | ❌ |
| `camp.manage` | ❌ | ❌ | **Default** | ❌ | ❌ | ❌ | ❌ |
| `camp.view_coop` | ❌ | ❌ | ❌ | ❌ | **Default** | ❌ | ❌ |
| `camp.view_public` | ❌ | ❌ | ❌ | ❌ | ❌ | **Default** | ❌ |
| `vaccinator.manage` | **Default** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `vaccinator.approve` | ❌ | **Default** | **Default** | ❌ | ❌ | ❌ | ❌ |
| `farmer.register` | **Default** | ❌ | **Default** | **Default** | ❌ | ❌ | ❌ |
| `farmer.verify` | ❌ | ❌ | **Default** | **Default** | ❌ | ❌ | ❌ |
| `farmer.read` | ❌ | ❌ | **Default** | **Default** | ❌ | ❌ | ❌ |
| `farmer.phone.view` | ❌ | ❌ | **Default** (Audited) | Explicit Grant | ❌ | ❌ | ❌ |
| `farmer.outreach` | ❌ | ❌ | ❌ | ❌ | Explicit Grant | ❌ | ❌ |
| `farmer.account.provision` | Explicit Grant | ❌ | Explicit Grant | Explicit Grant | ❌ | ❌ | ❌ |
| `animal.register` | ❌ | ❌ | ❌ | **Default** | ❌ | ❌ | ❌ |
| `animal.register.fallback` | ❌ | ❌ | **Default** (Gated) | ❌ | ❌ | ❌ | ❌ |
| `animal.read` | ❌ | ❌ | **Default** | **Default** | ❌ | ❌ | ❌ |
| `animal.verify` | ❌ | ❌ | **Default** | **Default** | ❌ | ❌ | ❌ |
| `animal.merge` | ❌ | ❌ | **Default** | ❌ | ❌ | ❌ | ❌ |
| `animal.transfer.request` | ❌ | ❌ | **Default** | **Default** | ❌ | ❌ | **Default** |
| `animal.transfer.decide` | ❌ | ❌ | **Default** | ❌ | ❌ | ❌ | ❌ |
| `event.create` | ❌ | ❌ | **Default** | **Default** | ❌ | ❌ | ❌ |
| `event.treatment.create` | ❌ | ❌ | **Default** | **Default** | ❌ | ❌ | ❌ |
| `event.correct` | ❌ | ❌ | **Default** | ❌ | ❌ | ❌ | ❌ |
| `event.review` | ❌ | ❌ | **Default** | ❌ | ❌ | ❌ | ❌ |
| `disease.report` | ❌ | ❌ | **Default** | **Default** | ❌ | ❌ | **Default** |
| `disease.review` | ❌ | **Default** | **Default** | ❌ | ❌ | ❌ | ❌ |
| `disease.confirm` | ❌ | Explicit Grant | Explicit Grant | ❌ | ❌ | ❌ | ❌ |
| `import.run` | ❌ | ❌ | **Default** | Explicit Grant | ❌ | ❌ | ❌ |
| `label.generate` | ❌ | ❌ | **Default** | Explicit Grant | ❌ | ❌ | ❌ |
| `field_worker.availability.record`| ❌ | ❌ | **Default** | ❌ | ❌ | ❌ | ❌ |
| `help.create` | ❌ | ❌ | **Default** | **Default** | ❌ | ❌ | **Default** |
| `help.manage` | ❌ | ❌ | **Default** | ❌ | ❌ | ❌ | ❌ |
| `aggregate.view` | **Default** | **Default** | **Default** | **Default** | **Default** | **Default** | ❌ |
| `map.view` | ❌ | **Default** | **Default** | ❌ | ❌ | ❌ | ❌ |
| `export.run` | **Default** | **Default** | **Default** | ❌ | ❌ | ❌ | ❌ |
| `notification.read` | ❌ | ❌ | ❌ | ❌ | **Default** | **Default** | **Default** |
| `notification.manage` | ❌ | **Default** | ❌ | ❌ | ❌ | ❌ | ❌ |
| `own.read` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **Default** |

---

## 3. Scope Enforcement Architecture

1. **Deny by Default:** No access is permitted unless an active grant matches both the requested capability and the resource hierarchy.
2. **Server-Derived Scope:**
   - **DAHO:** Derived strictly from `daho_district_assignments WHERE ended_at IS NULL`. Client-submitted `district_id` query parameters are ignored as trust anchors and validated against the session.
   - **VO / FW:** Derived strictly from active assignments in `user_village_assignments`.
   - **Dairy Staff:** Scoped to active assignments in `cooperative_villages` via `cooperative_staff_assignments`.
   - **Farmer:** Scoped strictly to `farmer_user_links` where `user_id = auth.uid()`.
3. **SYS_ADMIN Separation:**
   - Platform technical administrators manage users and technical configuration.
   - SYS_ADMIN has **no operational campaign, vaccination, or animal registration permissions by default**.
   - Any support intervention in district operations requires an explicit, audited entry in `user_permission_grants` with a documented reason.

