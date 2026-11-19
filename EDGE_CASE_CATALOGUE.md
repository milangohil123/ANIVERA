# PashuRakshak Botad — Edge Case Catalogue

**Status:** Implementation/QA baseline. This catalogue operationalises approved workflows; it does not create new clinical, legal or departmental policy.  
**Rule:** Where a policy is undefined, reject/hold safely and record the open decision. Do not guess.

For every case, tests must record actor, permission, scope, input, expected/actual result, DB effect, audit evidence and pass/fail. `DB impact` below is logical; map to actual final table names after schema verification.

## 1. Farmer onboarding and accounts

| ID | Trigger / actor | Expected response and validation | Persistence/audit | Gujarati message / recovery | Test |
|---|---|---|---|---|---|
| EC-F01 | Staff submits missing required farmer fields | Reject missing fields; requiredness follows PRD | No farmer record | `જરૂરી માહિતી ભરો.` Correct and resubmit | Missing-field API |
| EC-F02 | Possible duplicate farmer | Flag/block according to approved matching policy; never auto-merge | Preserve records; audit review | `મળતી આવતી ખેડૂત નોંધ મળી છે.` Review existing record | Duplicate candidate |
| EC-F03 | Shared mobile number | Do not assume one number equals one person; follow approved shared-mobile policy; unresolved cases held | No silent merge/link | `આ મોબાઇલ નંબર અન્ય નોંધમાં પણ છે.` Use authorised review | Shared-mobile |
| EC-F04 | Invalid OTP | Reject; apply configured security controls | No account creation; auth event as configured | `OTP યોગ્ય નથી.` Retry | Invalid OTP |
| EC-F05 | Expired OTP | Reject and request new OTP | No account mutation | `OTP ની સમયમર્યાદા પૂર્ણ થઈ છે.` Request new OTP | Expired OTP |
| EC-F06 | OTP provider/network unavailable | Show service failure; no authentication bypass | No account mutation | `OTP સેવા હાલ ઉપલબ્ધ નથી.` Retry later | Provider failure |
| EC-F07 | Farmer has no smartphone | Use assisted staff workflow only if approved; no assumed credentials | Farmer may exist without login | `ખેડૂત માટે સહાયિત નોંધણી જરૂરી છે.` Authorised assistance | No-smartphone |
| EC-F08 | Farmer exists, account not provisioned | Separate authorised provisioning action | Provisioning audit; farmer unchanged | `ખાતું હજી સક્રિય નથી.` Request authorised provisioning | Account separation |
| EC-F09 | Mobile change requested | Require approved verification/authority; no silent overwrite | Before/after audit | `મોબાઇલ નંબર બદલવા માટે ચકાસણી જરૂરી છે.` Follow approved process | Mobile-change |
| EC-F10 | Wrong village on farmer record | Deny out-of-scope change; route correction to authorised workflow | No scope mutation until authorised | `ગામની માહિતી ચકાસવાની જરૂર છે.` Ask authorised staff | Wrong-village |
| EC-F11 | Required consent/verification missing | Hold operation if PRD requires it; do not invent requirements | No downstream action | `જરૂરી ચકાસણી બાકી છે.` Complete approved check | Missing evidence |
| EC-F12 | Public signup attempt | Deny; no public self-registration | No farmer/user row | `આ નોંધણી અધિકૃત કર્મચારી દ્વારા થાય છે.` Contact staff | Signup denial |

## 2. Animal identity and ownership

| ID | Trigger / actor | Expected response and validation | Persistence/audit | Gujarati message / recovery | Test |
|---|---|---|---|---|---|
| EC-A01 | Duplicate internal/tag/QR identifier | Reject/flag for authorised resolution; never merge silently | No duplicate identity; audit attempt | `આ ઓળખ નંબર પહેલેથી નોંધાયેલ હોઈ શકે છે.` Review | Duplicate ID |
| EC-A02 | Bharat Pashudhan tag absent | Permit if other required fields pass; tag is optional | External tag null | `બાહ્ય ટૅગ ઉપલબ્ધ નથી.` Continue | Optional tag |
| EC-A03 | Tag damaged/missing | Use approved alternate verification; do not invent tag issuance | Verification event if supported | `ટૅગ વાંચી શકાય તેમ નથી.` Refer to authorised staff | Damaged tag |
| EC-A04 | QR scan fails | Permit validated manual lookup where approved | Record method if supported | `QR સ્કેન થઈ શક્યું નથી.` Retry/manual search | QR fallback |
| EC-A05 | Wrong owner linked | Do not edit owner as a shortcut; use authorised correction/transfer | Owner unchanged; audit request | `માલિકીની માહિતી સુધારવા મંજૂરી જરૂરી છે.` Request review | Wrong owner |
| EC-A06 | Transfer request submitted | Create pending request; owner remains unchanged | Request and audit | `માલિકી બદલવાની વિનંતી મોકલાઈ છે.` Track status | Request not transfer |
| EC-A07 | Transfer rejected | Keep current owner; record reason/decision | Rejection history | `માલિકી બદલવાની વિનંતી નામંજૂર થઈ.` Follow defined process | Rejection |
| EC-A08 | Conflicting transfer requests | Hold for authorised resolution; no automatic selection | Preserve requests/history | `માલિકી અંગે વિરોધાભાસી વિનંતી છે.` Authorised review | Conflict |
| EC-A09 | Animal sold/moved/dead | Apply only approved lifecycle transition; never delete history | Status/event history | `પશુની સ્થિતિ બદલવા ચકાસણી જરૂરી છે.` Authorised update | Lifecycle |
| EC-A10 | Cross-village/district movement | Validate authorised location/transfer process; client ID cannot change scope | Audited change only after approval | `સ્થળ બદલવા અધિકૃત પ્રક્રિયા જરૂરી છે.` Request review | Movement scope |
| EC-A11 | Flock/group registration | Use only approved flock model; otherwise hold | Persist only per approved model | `જૂથ નોંધણી માટે મંજૂર પ્રક્રિયા અનુસરો.` Review | Flock model |
| EC-A12 | Ownership dispute | Prevent disputed ownership mutation pending authorised decision | Preserve current owner and audit/dispute if supported | `માલિકી અંગે વિવાદ નોંધાયો છે.` Refer to authority | Dispute |

## 3. FW-first registration and fallback

| ID | Trigger / actor | Expected response | Persistence/audit | Gujarati message / recovery | Test |
|---|---|---|---|---|---|
| EC-R01 | Assigned FW registers animal | Allow if permission and village assignment valid | Animal and actor audit | `પશુ નોંધણી સફળ થઈ.` Continue | FW allowed |
| EC-R02 | FW registers outside assigned village | Deny unless explicit authorised scope allows | No mutation; security audit | `આ ગામ તમારા કાર્યક્ષેત્રમાં નથી.` Contact VO | FW scope |
| EC-R03 | VO registers while FW available | Block fallback; route to FW | No animal mutation | `ફીલ્ડ વર્કર ઉપલબ્ધ હોવાથી આ નોંધણી કરી શકાતી નથી.` Assign to FW | FW-first |
| EC-R04 | VO has no unavailability record | Block | No animal mutation | `અધિકૃત અનુપલબ્ધતાની નોંધ જરૂરી છે.` Record valid evidence | Missing evidence |
| EC-R05 | VO has valid authorised unavailability and reason | Permit only with fallback permission and VO scope | Link fallback evidence and actor | `વૈકલ્પિક નોંધણી મંજૂર છે.` Continue | Valid fallback |
| EC-R06 | Evidence expired/revoked/invalid | Deny fallback | No animal mutation; audit | `અનુપલબ્ધતાની મંજૂરી માન્ય નથી.` Obtain valid authorisation | Invalid evidence |
| EC-R07 | Offline VO fallback sync | Revalidate evidence/scope server-side; hold/reject safely if invalid | No bypass through sync | `નોંધની અધિકૃતતા ચકાસાઈ રહી છે.` Keep pending | Offline fallback |

## 4. Campaigns, camps and vaccination

| ID | Trigger / actor | Expected response | Persistence/audit | Gujarati message / recovery | Test |
|---|---|---|---|---|---|
| EC-C01 | SYS_ADMIN creates campaign without explicit operational grant | Deny; technical admin is not campaign owner | No campaign mutation | `આ અભિયાન માટે પરવાનગી નથી.` DAHO action | Campaign RBAC |
| EC-C02 | DAHO creates campaign outside assigned district | Server denies | No campaign | `આ જિલ્લો તમારા કાર્યક્ષેત્રમાં નથી.` Select authorised scope | DAHO scope |
| EC-C03 | VO configures campaign without grant | Deny; VO assigns FWs, DAHO configures campaign | No config change | `અભિયાન ગોઠવવાની પરવાનગી નથી.` Contact DAHO | Campaign ownership |
| EC-C04 | VO assigns FW outside authorised village | Deny | No assignment | `આ ગામ માટે સોંપણી અધિકૃત નથી.` Select authorised village | Assignment scope |
| EC-C05 | Cooperative proposes camp | Accept proposal only with permission; status remains proposed/pending | Camp proposal and actor audit | `કેમ્પની દરખાસ્ત મોકલાઈ છે.` Await VO | Proposal |
| EC-C06 | Cooperative treats camp as vaccinator authority | Deny vaccination without separate authorisation | No vaccination event | `રસીકરણ માટે અલગ અધિકૃતતા જરૂરી છે.` Use authorised vaccinator | Separation |
| EC-C07 | No authorised vaccinator available | Do not record vaccination; handle camp status only per approved flow | No vaccination event | `અધિકૃત રસીકરણકર્તા ઉપલબ્ધ નથી.` Follow approved camp process | No vaccinator |
| EC-C08 | VO confirms/reschedules/rejects camp | Permit only with `camp.manage` and scope | Camp status history/audit | `કેમ્પની સ્થિતિ અપડેટ થઈ.` Notify parties | VO decision |
| EC-C09 | Camp cancelled | Prevent new actions under cancelled state; preserve history | Status/audit; no deletion | `કેમ્પ રદ કરવામાં આવ્યો છે.` Use active schedule | Cancelled camp |
| EC-C10 | Farmer absent | Do not mark vaccinated; record absence only if approved | No vaccination event | `ખેડૂત હાજર નથી.` Follow approved follow-up | Absent farmer |
| EC-C11 | Vaccine stock unavailable | No vaccination event if not performed; no false stock movement | Ledger unchanged unless approved transaction | `રસીનો જથ્થો ઉપલબ્ધ નથી.` Refer to stock manager | No stock |
| EC-C12 | Overlapping camps | Flag conflict; do not invent priority/automatic reassignment | No silent schedule change | `કેમ્પના સમય અથવા સંસાધનમાં અથડામણ છે.` Review | Overlap |
| EC-C13 | Duplicate vaccination submission | Idempotency/deduplication; return original outcome | One vaccination event | `આ રસીકરણ નોંધ પહેલેથી પ્રાપ્ત થઈ છે.` View record | Duplicate submit |
| EC-C14 | Invalid vaccination date | Apply only approved date rules; no invented backdating limits | Reject invalid event | `તારીખ યોગ્ય નથી.` Correct date | Date validation |
| EC-C15 | Routine vaccination without VO approval | Permit if vaccinator authorised and validations pass | Vaccination event/audit | `રસીકરણ નોંધ સફળ થઈ.` Continue | No mandatory approval |
| EC-C16 | VO audits/corrects vaccination | Require explicit permission and reason; preserve old value | Correction audit/history | `સુધારો કારણ સાથે નોંધાયો.` View history | Correction |
| EC-C17 | Batch number omitted | Permit; batch optional | Null batch | `બેચ નંબર ઉપલબ્ધ નથી.` Continue | Optional batch |

## 5. Vaccine stock

| ID | Trigger / actor | Expected response | Persistence/audit | Gujarati message / recovery | Test |
|---|---|---|---|---|---|
| EC-S01 | Unauthorised stock edit | Deny | No ledger entry | `જથ્થા વ્યવસ્થાપનની પરવાનગી નથી.` Contact stock manager | Stock RBAC |
| EC-S02 | Issue exceeds available balance | Reject with transaction-safe balance check | No issue ledger row | `ઉપલબ્ધ જથ્થો પૂરતો નથી.` Review balance | Insufficient stock |
| EC-S03 | Duplicate stock retry | Idempotency prevents duplicate movement | One ledger movement | `આ જથ્થા વ્યવહાર પહેલેથી નોંધાયો છે.` View ledger | Duplicate movement |
| EC-S04 | Required reason/reference missing | Reject | No adjustment | `જથ્થા ફેરફારનું કારણ જરૂરી છે.` Enter reason | Missing reason |
| EC-S05 | Concurrent stock issues | Transaction/locking prevents invalid balance | Only valid committed movements | `જથ્થો ફરી ચકાસો.` Refresh | Concurrency |
| EC-S06 | Invalid stock import rows | Validate before commit; partial mode only if approved | No ambiguous partial commit | `કેટલીક પંક્તિઓમાં ભૂલ છે.` Review error report | Import validation |

## 6. Disease reporting and review

| ID | Trigger / actor | Expected response | Persistence/audit | Gujarati message / recovery | Test |
|---|---|---|---|---|---|
| EC-D01 | Duplicate disease report | Flag/link possible duplicate; do not silently discard evidence | Preserve reports and relation if supported | `સમાન રિપોર્ટ મળ્યો હોઈ શકે છે.` Review | Duplicate report |
| EC-D02 | Animal reference missing | Permit only if approved flow supports unlinked report; otherwise hold | No invalid FK | `પશુની વિગતો જરૂરી છે.` Select/verify animal | Missing animal |
| EC-D03 | Photo missing | Require only if PRD says mandatory | Persist according to approved requiredness | `ફોટો ઉપલબ્ધ નથી.` Continue if optional | Optional photo |
| EC-D04 | Location missing/invalid | Apply approved location requirement; do not fabricate coordinates | No false location | `સ્થળની માહિતી ચકાસો.` Correct/hold | Location |
| EC-D05 | Incorrect symptoms | Correct only via approved edit/review; preserve history | Audit correction | `લક્ષણોની માહિતી ફરી ચકાસો.` Review | Symptom correction |
| EC-D06 | Review delayed | Remain suspected/pending; do not invent SLA/auto-confirm | No confirmation | `અધિકૃત સમીક્ષા બાકી છે.` Track | Delayed review |
| EC-D07 | Conflicting assessments | Route to authorised review; do not auto-select diagnosis | Preserve assessments/history | `અહેવાલોમાં મતભેદ છે.` Authorised review | Conflict |
| EC-D08 | Unauthorised confirmation | Deny | No confirmed state | `રોગની પુષ્ટિ કરવાની પરવાનગી નથી.` Refer reviewer | Confirmation denial |
| EC-D09 | Multiple area reports | Show reports/alerts as reports; no outbreak confirmation | Preserve source/provenance | `આ વિસ્તારમાં રિપોર્ટ નોંધાયા છે; સમીક્ષા બાકી હોઈ શકે છે.` Review | No outbreak inference |
| EC-D10 | No reports in area | Never display “disease-free” | No mutation | `હાલ કોઈ રિપોર્ટ નોંધાયો નથી.` Not a disease-free conclusion | Zero-report |

## 7. Offline, sync and device failure

| ID | Trigger / actor | Expected response | Persistence/audit | Gujarati message / recovery | Test |
|---|---|---|---|---|---|
| EC-O01 | Network lost during entry | Save supported draft locally; show unsynced status | No server record until received | `રેકોર્ડ ઉપકરણમાં સાચવાયો છે; સિંક બાકી છે.` Retry online | Offline draft |
| EC-O02 | Offline grant expired | Require online reauth for protected new actions; retain pending data | No unauthorised new action | `ઓફલાઇન મંજૂરી પૂર્ણ થઈ છે. ફરી લૉગિન કરો.` Reauthenticate | Expiry |
| EC-O03 | Partial sync | Per-item pending/success/failed status; retry safe failures only | Accepted items remain | `કેટલાક રેકોર્ડ સિંક થયા નથી.` Retry failures | Partial sync |
| EC-O04 | Duplicate retry | Idempotency key/deduplication | One domain event | `આ રેકોર્ડ પહેલેથી પ્રાપ્ત થયો છે.` View acknowledgement | Duplicate event |
| EC-O05 | Concurrent edit | Detect version conflict; never overwrite silently | Preserve committed version/conflict metadata | `આ માહિતી અન્ય ઉપકરણથી બદલાઈ છે.` Refresh/review | Concurrent edit |
| EC-O06 | Lost ACK after server commit | Retry same idempotency key; return original outcome | One server event | `સિંકની પુષ્ટિ મળી નથી; ફરી પ્રયાસ કરો.` Safe retry | Lost ACK |
| EC-O07 | Logout with pending sync | Warn; offer stay/sync/safe exit; preserve queue | Local queue retained | `સિંક બાકી છે. લૉગઆઉટ પહેલાં તપાસો.` Stay/safe exit | Pending logout |
| EC-O08 | Browser storage quota/failure | Do not claim local save; warn; use recovery only if approved | No false saved state | `ઉપકરણમાં માહિતી સાચવી શકાઈ નથી.` Retry/contact support | Storage failure |
| EC-O09 | Device lost | Protect/revoke session via approved process; unsynced-only data may be unrecoverable; be honest | Revoke/audit; server data retained | `ઉપકરણ ગુમ થયું હોય તો અધિકૃત સહાયનો સંપર્ક કરો.` Incident process | Device-loss procedure |
| EC-O10 | Second device login | Apply approved session/device policy; do not invent single-device rule | Session/audit | `બીજા ઉપકરણથી પ્રવેશ થયો છે.` Follow policy | Multi-device |
| EC-O11 | Server has not received payload | Server cannot review it; client retains locally | No server domain event | `રેકોર્ડ હજી સર્વર સુધી પહોંચ્યો નથી.` Retry/recovery | Unreceived payload |
| EC-O12 | Sync dependency order invalid | Hold child until parent exists | No orphan records | `પહેલાનો રેકોર્ડ સિંક થયા પછી ફરી પ્રયાસ કરો.` Retry | Dependency |

## 8. Imports, QR and data quality

| ID | Trigger | Expected response | Persistence/audit | Gujarati message / recovery | Test |
|---|---|---|---|---|---|
| EC-I01 | Corrupt import file | Reject before processing | No import rows | `ફાઇલ વાંચી શકાતી નથી.` Upload valid file | Corrupt file |
| EC-I02 | Required columns missing | List exact missing headers | No commit | `ફાઇલમાં જરૂરી કૉલમ નથી.` Correct template | Missing columns |
| EC-I03 | Duplicate rows | Detect/report; no silent duplicate | Idempotent/transactional import | `ફાઇલમાં ડુપ્લિકેટ પંક્તિઓ છે.` Review | Duplicate rows |
| EC-I04 | Invalid dates/numbers | Report row/column errors | Invalid rows not committed unless approved partial mode | `તારીખ અથવા આંકડો યોગ્ય નથી.` Correct | Invalid data |
| EC-I05 | Unknown village | Reject/hold row; never create village implicitly | No unapproved village | `ગામ ઓળખી શકાયું નથી.` Map to authorised village | Unknown village |
| EC-I06 | Partial import failure | All-or-nothing unless partial mode approved; report exact outcome | No ambiguous partial state | `આયાત પૂર્ણ થઈ નથી.` Review errors | Partial import |
| EC-I07 | QR generation failure | Do not mark label generated; safe retry | No false QR status | `QR કોડ બનાવી શકાયો નથી.` Retry | QR failure |
| EC-I08 | QR resolves to another animal | Block mismatch | No mutation; audit | `QR અને પશુની ઓળખ મેળ ખાતી નથી.` Verify | QR mismatch |

## 9. Security, privacy and authorisation

| ID | Trigger | Expected response | Persistence/audit | Gujarati message / recovery | Test |
|---|---|---|---|---|---|
| EC-P01 | Cross-district request | Deny using server-derived assignment | No leak/mutation; security audit | `આ માહિતી તમારા અધિકૃત કાર્યક્ષેત્રમાં નથી.` Contact admin | Cross-district |
| EC-P02 | Cross-village FW request | Deny unless assignment permits | No leak/mutation | `આ ગામ તમારા કાર્યક્ષેત્રમાં નથી.` Contact VO | Cross-village |
| EC-P03 | Cooperative requests owner details | Deny by default; return permitted village aggregate | No personal data exposure | `વ્યક્તિગત માહિતી માટે પરવાનગી નથી.` Use aggregate | Cooperative privacy |
| EC-P04 | Unauthorised export | Deny and audit as configured | No export generated | `ડેટા નિકાસ કરવાની પરવાનગી નથી.` Request access | Export RBAC |
| EC-P05 | Expired session | Reject protected request; require reauth | No protected mutation | `તમારું સત્ર પૂર્ણ થયું છે.` Log in | Session expiry |
| EC-P06 | Client tampers role/permission | Ignore client claims; resolve server-side | No privilege change | `આ કામગીરી માટે પરવાનગી નથી.` Contact admin | Privilege tampering |
| EC-P07 | SQL injection/XSS/malicious input | Parameterise, validate, encode and reject unsafe input | No unintended mutation | `માહિતી યોગ્ય નથી.` Correct input | Security tests |
| EC-P08 | Sensitive data in logs/notification | Redact/omit sensitive fields | No data leak | Generic notice | Privacy test |
| EC-P09 | DAHO assignment revoked during session | Recheck scope on protected requests | Deny subsequent out-of-scope action | `તમારું કાર્યક્ષેત્ર બદલાયું છે.` Refresh/relogin | Revocation |

## 10. Test evidence

For each case record test ID, environment/build, actor/permission/scope, input, expected and actual result, DB before/after where relevant, audit evidence, pass/fail/blocked and defect reference. A written test is not a passed test.
