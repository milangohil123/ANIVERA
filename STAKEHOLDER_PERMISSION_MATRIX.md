# PashuRakshak Botad — Stakeholder & Permission Matrix

**Status:** Workflow-aligned baseline. Final grants require departmental approval.  
**Security rule:** Deny by default. A role label does not itself grant an action. Backend permission and data-scope checks are mandatory.

## 1. Stakeholders

- **SYS_ADMIN:** Platform/technical administration. Not the default operational owner of district campaigns.
- **DAHO:** District Animal Husbandry Officer; manages operational setup, campaigns and vaccine stock within assigned district, subject to explicit grants.
- **VO:** Veterinary Officer; assigns FWs within authorised villages and performs other workflow actions only where explicitly permitted.
- **FW:** Field Worker; primary field animal registrar within assigned scope.
- **COOPERATIVE:** May propose/coordinate camps and access permitted village aggregates.
- **FARMER:** Only an existing, separately provisioned account; access limited to own permitted records/actions.
- **VACCINATOR:** A separately authorised vaccination actor/capability. Do not infer this authority from camp participation or another role. Implementation may model it as a role or explicit permission according to approved schema.

Role combinations/cardinality must follow the actual approved schema and departmental decision. Do not invent single-role or multi-role restrictions.

## 2. Canonical permissions

| Permission | Meaning | Required scope |
|---|---|---|
| `district.setup.manage` | District operational setup | Active DAHO-to-district assignment |
| `village.manage` | Village/geodata management | Assigned district |
| `gram_panchayat.manage` | GP management | Assigned district and valid village relation |
| `cooperative.manage` | Cooperative records | Assigned district |
| `veterinary_officer.manage` | VO records/assignments | Assigned district |
| `vaccine_stock.manage` | Stock ledger management | Assigned district/authorised stock location |
| `campaign.manage` | Create/configure campaign | DAHO assigned district |
| `farmer.account.provision` | Provision login for existing farmer | Explicit grant and audit |
| `animal.register` | Primary animal registration | FW authorised village or separately approved grant |
| `animal.register.fallback` | VO fallback registration | Valid authorised FW-unavailability record and reason; VO scope |
| `camp.propose` | Propose/coordinate camp | Cooperative's authorised relationship/scope |
| `camp.manage` | Confirm/reschedule/reject/manage camp | VO authorised scope or separately approved grant |
| `disease.review` | Review suspected disease report | Explicit veterinary reviewer scope |
| `animal.transfer.request` | Submit transfer request | Eligible owner/authorised animal relationship |
| `animal.transfer.decide` | Decide transfer request | Explicit decision authority and scope |

Additional capabilities may need explicit permissions, e.g. vaccination recording, export, user administration, disease confirmation and vaccination correction/audit. Do not grant them based on role name. Define consistent permission names in schema and obtain approval.

## 3. Default role/capability matrix

Legend: **Default** = current workflow responsibility, still subject to permission enforcement; **Explicit grant** = only if granted/approved; **No by default** = not permitted unless separately approved.

| Capability | SYS_ADMIN | DAHO | VO | FW | Cooperative | Farmer | Vaccinator |
|---|---|---|---|---|---|---|---|
| Platform technical administration | Explicit grant | No by default | No | No | No | No | No |
| District operational setup | No by default | Default, assigned district | No by default | No | No | No | No |
| Village/GP/cooperative/VO setup | No by default | Default, assigned district and grants | No by default | No | No | No | No |
| Create/configure campaign | No by default | Default, assigned district | No by default | No | No | No | No |
| Assign FW to campaign/village | No by default | Not default action | Default, authorised villages | No | No | No | No |
| Create farmer record | Only if approved staff grant | If approved | If approved | If approved | No by default | No public signup | No |
| Provision farmer login | Explicit `farmer.account.provision` | If granted | If granted | If granted | No by default | No | No |
| OTP login | If account provisioned | If account provisioned | If account provisioned | If account provisioned | If account provisioned | If account provisioned | If account provisioned |
| Primary animal registration | No by default | No by default | Fallback only under rule | Default in assigned village | No | No | No unless separately granted |
| VO fallback registration | No | No by default | Only with `animal.register.fallback` and valid evidence | N/A | No | No | No |
| Propose/coordinate camp | No | If approved | If approved | No by default | `camp.propose` | No by default | No |
| Confirm/reschedule/reject camp | No by default | If explicit grant | Default workflow with `camp.manage` | No | No by default | No | No |
| Administer/record vaccination | No by default | Only if separately authorised | Only if separately authorised | Only if separately authorised | No by camp role alone | No | Only with separate vaccinator authorisation |
| Manage vaccine stock | No by default | `vaccine_stock.manage` | Only if separately granted | No by default | No | No | No by default |
| Submit suspected disease report | As approved | As approved | As approved | As approved | No by default | If farmer reporting is enabled | As approved |
| Review suspected disease | No by default | Only if explicitly authorised | `disease.review` | No | No | No | No unless separately authorised veterinary reviewer |
| Confirm disease | No by default | Explicit confirmation grant and veterinary authority | Explicit confirmation grant and veterinary authority | No | No | No | No unless separately authorised |
| Request ownership transfer | No by default | As approved | As approved | As approved | No by default | `animal.transfer.request` for eligible own animal | No by default |
| Decide ownership transfer | No by default | Explicit decision grant | Explicit decision grant | No | No | No | No |
| View individual owner details | Explicit support grant/purpose | Explicit scope | Explicit scope | Assigned work scope | No by default | Own permitted details | Only if needed and authorised |
| View village overdue aggregate | If support grant | Assigned district | Authorised villages | Assigned work if allowed | Default linked-village aggregate | Own due items | If authorised |
| Export data | Explicit export grant/scope | Explicit grant/scope | Explicit grant/scope | Explicit grant/scope | Aggregate-only if explicitly granted | Own data if supported | Explicit grant/scope |

This is a default workflow matrix, not a final grant seed. Resolve all “if approved” rows before production.

## 4. Scope enforcement

1. Resolve authenticated user permissions server-side.
2. Resolve DAHO district assignment from trusted records.
3. Resolve VO/FW village assignments from trusted records.
4. Never trust client-supplied district/village IDs as proof of access.
5. Validate resource relationships on every read/write.
6. Recheck scope after assignment revocation or role changes.
7. Apply rules to APIs, imports, exports, offline sync, retries and background jobs.
8. Return safe denials without leaking private records in other scopes.
9. Audit privileged actions and denied access according to security policy.

## 5. Separation of duties

- DAHO campaign creation/configuration; VO FW assignment.
- Camp proposal/coordination distinct from camp decision.
- Camp assignment distinct from vaccinator authorisation.
- Farmer master record distinct from login account.
- Disease report distinct from review/confirmation.
- Transfer request distinct from transfer decision.
- Stock ledger movement distinct from vaccination event.
- SYS_ADMIN technical administration does not automatically grant operational authority.

## 6. API enforcement checklist

For every route, record authentication, canonical permission, scope source, field-level privacy, allowed state transition, audit event, idempotency requirement, offline/sync availability and export restrictions. Hidden UI buttons are not security. Test APIs directly with denied roles and tampered scope IDs.

## 7. Approval items

Confirm exact role grants/combination; farmer creator roles; provisioning authority; vaccination-record permission; disease confirmation authority; transfer decision authority; export fields/grants; SYS_ADMIN support access. Record decisions and evidence in `DECISION_REGISTER.md`.
