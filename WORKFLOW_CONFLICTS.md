# MASTER IMPLEMENTATION PROMPT — PASHURAKSHAK
## Universal Existing QR & Barcode Identification, Data Extraction, Verification and Complete Animal Registration Workflow

You are working on the existing PashuRakshak project.

Your task is to implement a complete, production-ready **Existing Animal Tag Registration System** for Field Workers (FW).

This is not just a QR scanner feature. It is a complete real-world workflow that allows an FW to register an animal that already has a physical QR Code or Barcode tag, retrieve whatever information is available from that tag or its linked source, collect missing animal and vaccination information, verify the information, and only then complete animal registration.

Follow the entire specification below.

---

# PART 1 — NON-NEGOTIABLE PROJECT RULES

Before implementation, understand the existing project and preserve its architecture.

Existing architecture:

- Frontend: React 19 + TypeScript + Vite.
- Backend: Python + FastAPI.
- Database: PostgreSQL 16 + PostGIS.
- ORM: SQLAlchemy 2.0 async.
- Validation: Pydantic v2.
- Offline storage: Dexie.js + IndexedDB.
- QR generation: Python qrcode.
- QR scanning: Existing @zxing/browser.
- UI language: Gujarati.
- Code comments and technical documentation: English.

Strict rules:

1. Do not replace the existing architecture.
2. Do not introduce Node.js, MongoDB, Firebase, Supabase, Spring Boot or another backend.
3. Do not introduce paid APIs or services.
4. Do not introduce RFID functionality in this implementation.
5. Remove RFID from the current selectable identification and scanning workflow, if it was previously introduced.
6. Support ONLY:
   - QR Code
   - Barcode
7. Remove Bharat Pashudhan ID as a selectable identification method in this workflow.
8. Do not delete or damage existing government identification data if already stored elsewhere.
9. Preserve the existing Gujarati design identity and navigation structure.
10. Do not invent government APIs, credentials, registration formats, vaccination history or animal records.

## CRITICAL DATABASE SAFETY

The production database schema is frozen.

Previously applied:
- pashurakshak_schema_v0.2.sql
- pashurakshak_schema_v0.3.1_patch.sql

Never:
- Rerun either SQL file.
- Execute Base.metadata.create_all().
- Create tables or columns.
- Alter existing constraints or types.
- Generate or apply migrations.
- Modify the production schema without explicit approval.

First inspect the existing SQLAlchemy models and actual database schema.

Reuse existing compatible tables, columns and relationships.

If the complete feature requires a database object that does not exist:
- Report the exact missing table/column/relationship.
- Explain why it is necessary.
- Stop that particular database-dependent implementation.
- Do not silently invent a JSON field or store unrelated information in an existing column.
- Do not pretend the feature is complete.

Never run write tests against pashurakshak_db.

Use only pashurakshak_test_db for database tests, after verifying the test database configuration and existing test safety guards.

---

# PART 2 — UNDERSTAND THE FOUR QR PAYLOAD CATEGORIES FIRST

Do NOT assume every QR contains only a unique number.

When FW scans an existing QR, capture the complete decoded payload and classify it into these FOUR primary categories.

### TYPE 1: UNIQUE IDENTIFIER / PLAIN STRING

Examples:

GJ-BTD-2025-001245

123456789012

ANIMAL-2024-00891

The QR contains only a number, alphanumeric identifier or simple text.

Required behaviour:

1. Capture the exact decoded value.
2. Preserve the original value.
3. Identify whether it looks like an identifier or unclassified text.
4. Do not assume that every 12-digit number is a verified government animal ID.
5. Check whether the identifier already exists in PashuRakshak.
6. Check its issuer/source if known.
7. If it is a valid usable identifier and has not been registered, allow FW to associate it with the animal after required verification.
8. If its meaning or issuer is unknown, mark it as unverified until verified.
9. Do not invent animal details from an identifier.

### TYPE 2: URL / WEBSITE / APPLICATION LINK

Examples:

https://example.gov.in/animal/12345

https://example.org/animal?id=12345

The QR contains a URL.

Required behaviour:

1. Decode the complete URL.
2. Display the URL to FW.
3. Validate the URL format.
4. Display the domain/host clearly.
5. Never automatically trust an arbitrary external URL.
6. Do not automatically execute scripts, download files or follow unsafe redirects.
7. Do not send private farmer or animal information to unknown external services.
8. Provide a clear Gujarati action: "લિંક ખોલો".
9. Open the link through a safe external browser flow after FW action.
10. Where an accessible and authorized source is available, retrieve the relevant animal information.
11. If the link requires login, OTP, CAPTCHA, authorization or manual interaction, clearly tell FW that manual verification is needed.
12. Never claim that a government record is verified merely because a webpage opened.
13. Never scrape restricted websites or bypass authentication.
14. If an authorized API or documented public endpoint exists, use it only according to its official documentation and permissions.
15. If information is successfully retrieved, extract relevant animal information and show it to FW for review.
16. If information cannot be retrieved, allow manual entry of the missing information.

Important security requirements:
- Protect against SSRF.
- Do not let the backend fetch arbitrary private/internal IP addresses.
- Restrict unsafe URL schemes.
- Validate redirects and final destination.
- Avoid exposing secrets or tokens.
- Do not automatically open untrusted links.

### TYPE 3: STRUCTURED ANIMAL DATA

The QR may contain JSON, XML or another structured format.

Example JSON:

{
  "tag_id": "GJ-BTD-001245",
  "species": "Cattle",
  "breed": "Gir",
  "sex": "Female",
  "date_of_birth": "2023-04-12",
  "issuer": "Example Authority"
}

Required behaviour:

1. Capture the complete decoded payload.
2. Identify its format.
3. Parse supported formats safely.
4. Extract relevant fields.
5. Preserve the original decoded payload separately where the existing schema supports it.
6. Display extracted information in a review screen.
7. Do not assume that field names or values are trustworthy.
8. Map supported fields to existing PashuRakshak animal fields.
9. Show unknown fields separately rather than discarding them silently.
10. Detect malformed, incomplete or unsupported structured data.
11. Never execute embedded code or scripts.
12. Do not mark extracted data as verified automatically.

### TYPE 4: OTHER / UNKNOWN / UNRECOGNIZED CONTENT

Examples:
- Encoded strings.
- Unsupported formats.
- Unexpected text.
- Malformed content.
- Unknown application references.
- Unsupported QR payloads.

Required behaviour:

1. Preserve the decoded content when safe and supported by the schema.
2. Display a readable representation to FW.
3. Mark it as UNKNOWN/UNSUPPORTED.
4. Do not guess its meaning.
5. Do not treat it as an animal ID automatically.
6. Offer:
   - Retry scan.
   - Manual identifier entry.
   - Authorized verification.
   - Continue with manual animal registration only if the required identity and animal information can be verified.
7. Do not silently discard the original scan result.

These are four primary payload categories, not a claim that every possible QR format can be understood automatically.

---

# PART 3 — UNIVERSAL QR AND BARCODE SCANNER

Implement a single reusable scanning experience for:

- QR Code.
- Supported 1D Barcode formats.

Use the existing @zxing/browser dependency wherever possible.

Requirements:

1. Mobile rear camera support.
2. Camera permission handling.
3. Camera unavailable state.
4. Camera permission denied state.
5. Low-light guidance.
6. Blurry or damaged tag handling.
7. Duplicate scan prevention.
8. Continuous scanning without repeatedly submitting the same result.
9. Manual identifier entry.
10. Clear scan success/failure messages.
11. Gujarati user interface.
12. Stop camera when the scanning screen closes.
13. Release camera resources properly.
14. Prevent multiple simultaneous camera sessions.
15. Avoid adding unnecessary dependencies.

Support common barcode formats compatible with the existing scanner. Do not claim every barcode format is supported without verifying the library.

The scanner must return:

- Decoded text.
- Symbology/format where available.
- Scan timestamp.
- Original scan result.
- Scanner status.

Do not use the QR image itself as the primary database lookup key.

The primary lookup key is the validated decoded identifier.

A photograph of the physical tag can be optional supporting evidence if the existing attachment system supports it.

---

# PART 4 — EXISTING TAG REGISTRATION WORKFLOW FOR FW

Implement the following real-world workflow.

## Step 1: Select Farmer

FW selects an existing farmer or registers a new farmer according to current permissions and workflows.

Use backend-authorized farmer and village scope.

## Step 2: Check Existing Animal Registration

Before creating a new animal, FW searches existing animal records.

Search by:
- Existing identifier.
- Farmer.
- Animal information where supported.

Do not create duplicate animal records.

If the animal is already registered, show the authorized existing animal profile.

If it is not registered, proceed.

## Step 3: Ask Whether Animal Already Has a Physical Tag

Show two primary choices:

A. Existing QR/Barcode Tag.

B. No Existing Tag.

### A. Existing QR/Barcode Tag

Open the universal scanner.

After scanning:
- Capture complete decoded payload.
- Detect the payload category.
- Show the result to FW.
- Follow the appropriate processing rules from Part 2.
- Perform duplicate identifier checks.

### B. No Existing Tag

Allow FW to register the animal using the existing approved internal identification process.

If the existing system supports internal QR generation:
- Generate a unique internal identifier.
- Generate its QR code.
- Associate it with the new animal.
- Clearly label it as an internally generated PashuRakshak identifier.

Never represent an internal code as a government-issued code.

---

# PART 5 — URL INFORMATION RETRIEVAL AND MANUAL FALLBACK

This section is extremely important.

Suppose FW scans an existing QR.

The QR contains a link to an external animal record.

FW opens that link and sees the animal's details.

The external record may contain:
- Animal identification number.
- Species.
- Breed.
- Sex.
- Age/date of birth.
- Owner/farmer details.
- Registration information.
- Other available details.

But it may not contain vaccination history.

Implement this exact behaviour:

1. Capture the URL.
2. Display it to FW.
3. Allow FW to open it.
4. If an authorized, technically supported data retrieval mechanism exists, retrieve available information.
5. Extract relevant animal fields.
6. Display extracted data to FW.
7. Allow FW to review and correct only according to authorized workflow.
8. Mark information source and verification status.
9. Identify missing mandatory information.
10. Ask FW to manually enter missing information.

Do not invent an API for the external website.

Do not assume that opening a URL means PashuRakshak can automatically retrieve the website's content.

If automatic retrieval is unavailable:
- FW manually views the external page.
- FW enters the relevant information into PashuRakshak.
- Preserve the source URL and manual verification details if the schema supports them.

Provide a clear button:

"બાહ્ય લિંક ખોલો"

After FW returns to PashuRakshak, the entered information must remain available.

---

# PART 6 — COMPLETE ANIMAL INFORMATION BEFORE REGISTRATION

This is a mandatory business rule.

An animal must not become a fully registered PashuRakshak animal until all required animal information has been collected and validated.

Separate fields into:

A. Mandatory animal registration information.

B. Optional animal information.

C. Existing tag information.

D. External source information.

E. Vaccination history.

F. Verification information.

Inspect the current animal registration DTOs, models and validation rules. Reuse existing required fields and authorized business rules.

Do not invent new mandatory clinical fields.

Show FW:
- Information already extracted.
- Information still missing.
- Information entered manually.
- Information requiring verification.

Do not silently fill missing fields with fake values, zeroes, random dates or guessed data.

The registration completion button must remain disabled while required information is incomplete or invalid.

---

# PART 7 — VACCINATION HISTORY MUST BE COLLECTED BEFORE FINAL REGISTRATION

This is another mandatory business rule.

Suppose the QR link provides:
- Animal ID.
- Species.
- Breed.
- Farmer details.

But it does not provide vaccination history.

PashuRakshak must not assume the animal has never been vaccinated.

Show a Gujarati section:

"અગાઉના રસીકરણની માહિતી"

Ask FW to collect information from the farmer and available vaccination records.

Where supported by the existing system, collect:

- Vaccine name/type.
- Vaccination date.
- Available batch number.
- Vaccination location/campaign if known.
- Vaccinator details if available.
- Supporting evidence or certificate where available.
- Information source.
- Verification status.

Important distinctions:

1. Information from an authorized external record.
2. Information from a vaccination certificate or other evidence.
3. Farmer-reported information.
4. FW-entered but unverified information.
5. Officially verified vaccination record.

Never mix these categories.

If the farmer reports vaccination but no official evidence exists:
- Record it as farmer-reported/unverified historical information if existing business rules permit.
- Do not represent it as an officially verified vaccination.
- Preserve source and verification status.

If the farmer says that the animal has never been vaccinated:
- Record the farmer's response as reported.
- Do not automatically create a fake vaccination record.
- Do not automatically mark a vaccination as administered.
- Follow existing authorized vaccination and campaign workflows.

Do not force a fake vaccination date or fake vaccine batch.

If vaccination history is unknown:
- Mark it as UNKNOWN/NOT AVAILABLE.
- Do not silently treat unknown as never vaccinated.

Registration must not falsely claim a complete verified medical history.

The final registration summary must clearly distinguish:
- Known vaccination history.
- Farmer-reported history.
- Verified historical records.
- Unknown/missing history.

If existing business policy requires vaccination information to be collected before registration, require an explicit history response:
- Available and entered.
- Farmer reports none.
- Unknown/not available with reason.

Do not block registration merely because historical evidence does not exist, unless an existing approved policy explicitly requires verified evidence. Instead, preserve uncertainty and verification status.

---

# PART 8 — REVIEW AND CONFIRMATION SCREEN

Before final registration, show a complete review screen in Gujarati.

Sections:

1. Farmer information.
2. Animal information.
3. Existing QR/Barcode information.
4. Complete decoded payload summary.
5. External link and source, if any.
6. Extracted animal details.
7. Manually entered animal details.
8. Vaccination history.
9. Verification status.
10. Missing/unknown information.
11. Duplicate check result.

Show source labels such as:

- QR માંથી મેળવેલી માહિતી.
- બાહ્ય લિંકમાંથી મેળવેલી માહિતી.
- ખેડૂત દ્વારા જણાવેલી માહિતી.
- FW દ્વારા દાખલ કરેલી માહિતી.
- અધિકૃત રીતે ચકાસેલી માહિતી.
- હજી ચકાસવાની બાકી માહિતી.

FW must explicitly confirm the final registration.

If mandatory information is missing, invalid or unresolved, do not allow completion.

Do not falsely mark unverified information as verified.

---

# PART 9 — SAVE AND CREATE ANIMAL IDENTITY

After successful validation and confirmation:

1. Save the animal record using existing backend services.
2. Associate the existing QR/Barcode identifier with that animal.
3. Preserve the identifier's source and verification status if supported by the existing schema.
4. Save available animal information.
5. Save historical vaccination information according to existing vaccination business rules and authorization.
6. Preserve the external source URL where supported.
7. Generate/use the internal PashuRakshak Animal ID only after successful registration.
8. Ensure all related records are connected correctly.
9. Use a database transaction where the existing architecture supports it.
10. Prevent partial or duplicate registration.

If any required save operation fails:
- Roll back the registration transaction where appropriate.
- Show an understandable Gujarati error.
- Do not show a false registration-success message.
- Preserve pending offline data safely if offline.

Never overwrite an existing animal record without authorization.

---

# PART 10 — NEXT VISIT: SCAN THE SAME TAG AND FIND THE SAME ANIMAL

This is the most important acceptance scenario.

First visit:

- Farmer: Rameshbhai.
- Animal: Cow.
- Existing QR: GJ-BTD-2025-001245.
- FW scans the existing QR.
- QR is decoded.
- Information is retrieved or entered manually.
- Missing vaccination history is collected with correct source/verification labels.
- Animal registration is completed.
- QR identifier is mapped to the PashuRakshak Animal ID.

Second visit:

- FW opens Scan Animal.
- FW scans the exact same physical QR.
- Scanner decodes the same value.
- Backend performs exact identifier lookup.
- Correct existing animal is found.
- The application opens the same animal profile.
- Show its stored details and vaccination history.
- Do not ask FW to register the animal again.
- Do not generate another animal ID.
- Do not create duplicate vaccination records.

If the QR is damaged:
- Retry scan.
- Allow manual identifier entry.
- Search by authorized animal/farmer information.
- Clearly show whether the identity was matched or remains unverified.

---

# PART 11 — DUPLICATE AND EDGE CASES

Handle all of these:

1. Same QR scanned twice during registration.
2. Same barcode scanned twice.
3. Identifier already linked to the same animal.
4. Identifier linked to a different animal.
5. Identifier linked to another farmer.
6. Identifier found but animal details differ.
7. QR has only a number.
8. QR has a URL.
9. QR has JSON.
10. QR has XML or unsupported structured data.
11. QR has unknown encoded text.
12. QR is malformed.
13. QR is damaged or blurred.
14. QR is partially covered.
15. Camera permission denied.
16. No internet connection.
17. External link is unavailable.
18. External link requires login.
19. External source is not trusted.
20. External record contains incomplete animal data.
21. External record contains no vaccination history.
22. Farmer has no vaccination certificate.
23. Farmer does not remember previous vaccination.
24. Farmer provides conflicting information.
25. External data and farmer-reported data conflict.
26. Animal already exists but QR is not mapped.
27. Existing tag has been replaced.
28. One animal has both QR and barcode.
29. Two different animals have different tags belonging to the same farmer.
30. A scan succeeds but database save fails.
31. Registration is interrupted.
32. User logs out with unsynced registration data.
33. Offline registration followed by later synchronization.
34. Identifier is found in another authorized geographic scope.
35. Unauthorized FW attempts to access another village's animal.

Rules:

- Never fuzzy-match identifiers.
- Use exact normalized identifier matching only where appropriate.
- Preserve original decoded value.
- Do not discard leading zeroes.
- Do not automatically convert identifiers to numeric database values.
- Prevent duplicate active mappings.
- Enforce district/village authorization on backend.
- Do not trust client-supplied farmer, village or district IDs.
- Do not expose another farmer's information to an unauthorized FW.
- Never create fake animal or vaccination records.

---

# PART 12 — OFFLINE AND SYNC SUPPORT

The project uses Dexie.js and IndexedDB.

Support existing offline architecture.

When internet is unavailable:

1. Allow authorized FW to capture the QR/Barcode scan result.
2. Preserve decoded content and manual entries locally.
3. Mark the registration as pending synchronization.
4. Do not claim server-side duplicate verification has completed.
5. Do not claim an external URL has been verified.
6. Preserve unsynced animal and vaccination history data.
7. On reconnection, send the pending data through the existing sync workflow.
8. Server must repeat all validation and duplicate checks.
9. Handle synchronization conflicts safely.
10. Never silently discard pending records.

Follow existing offline authorization and sync rules.

---

# PART 13 — UI/UX REQUIREMENTS

All visible text must be Gujarati.

Build a clean, mobile-first FW registration experience.

Required screens/components:

1. Existing animal search.
2. Existing tag / no tag selection.
3. QR/Barcode scanner.
4. Scan result and payload classification.
5. External URL review and open action.
6. Extracted information review.
7. Missing information form.
8. Previous vaccination history form.
9. Source and verification labels.
10. Duplicate check result.
11. Complete registration review.
12. Successful registration screen.
13. Existing animal profile screen.

UI requirements:

- Preserve current PashuRakshak design system.
- Reuse existing components.
- Clear Gujarati labels.
- Large touch targets.
- Good camera experience.
- Loading, success, warning and error states.
- No unnecessary animations.
- Do not redesign unrelated screens.
- Do not break existing farmer, VO, DAHO or FW workflows.

---

# PART 14 — IDENTIFIER DATA MODEL AND EXISTING SCHEMA INSPECTION

Before coding, inspect:

- Existing animal models.
- Existing QR identifier fields.
- Existing barcode fields.
- Animal ID generation.
- Animal registration API.
- Vaccination history model.
- Historical vaccination data.
- Farmer/animal relationship.
- Existing duplicate constraints.
- Existing offline sync payload.
- Existing animal detail APIs.

Determine whether the current schema supports:
- Existing QR identifier mapping.
- Existing barcode identifier mapping.
- Multiple identifiers per animal.
- Original decoded payload storage.
- Identifier issuer/source.
- Verification status.
- External source URL.
- Vaccination history source.
- Historical unverified records.

Do not add new columns/tables without approval.

Do not store the original QR payload in an unrelated field merely to make the feature appear complete.

If the existing schema does not support a requirement, report the exact missing schema capability and provide a separate proposed change for approval.

---

# PART 15 — TESTING AND ACCEPTANCE CRITERIA

Use isolated test database only.

Do not run write tests against production.

Create tests for:

A. Plain identifier QR.

B. QR containing a URL.

C. QR containing structured JSON.

D. Unknown QR content.

E. Barcode scan result.

F. Invalid QR.

G. Duplicate identifier.

H. Existing animal lookup.

I. External link unavailable.

J. External link requiring login.

K. Manual entry fallback.

L. Extracted animal data review.

M. Missing animal information.

N. Missing vaccination history.

O. Farmer-reported vaccination history.

P. Officially verified vaccination history.

Q. Unknown vaccination history.

R. Registration blocked when mandatory information is missing.

S. Successful complete registration.

T. Second scan opens the same animal.

U. Duplicate registration prevented.

V. Different farmer's identifier access denied.

W. Offline registration and synchronization.

X. Save failure and recovery.

Y. Multiple identifiers mapped to one animal if supported by the existing schema.

Z. No RFID functionality exposed in the UI.

Do not disable tests to obtain a passing result.

For frontend IndexedDB tests, use a deterministic IndexedDB test implementation such as fake-indexeddb if appropriate. Do not weaken production offline logic to satisfy tests.

Run backend tests only after confirming TEST_DATABASE_URL points to pashurakshak_test_db.

Report actual commands and actual pass/fail counts.

---

# PART 16 — IMPLEMENTATION ORDER

Implement in this sequence:

1. Inspect current code and database schema.
2. Report existing capabilities and missing schema support.
3. Audit existing QR/Barcode scanning implementation.
4. Implement four-category QR payload classification.
5. Implement complete decoded payload capture.
6. Implement barcode decoding.
7. Implement safe URL handling and external link review.
8. Implement supported data extraction.
9. Implement identifier duplicate checking.
10. Implement existing tag registration workflow.
11. Implement missing animal information collection.
12. Implement historical vaccination information collection and source labels.
13. Implement review and confirmation.
14. Implement safe final registration and identifier mapping.
15. Implement second-scan animal lookup.
16. Implement offline handling.
17. Implement tests.
18. Verify all FW authorization and geographic scope rules.
19. Build frontend and run relevant tests.
20. Provide completion report.

Do not jump directly to UI work before understanding the existing backend and schema.

Do not stop after producing a plan if the existing schema supports implementation.

Do not repeatedly ask for permission for every small coding step.

If one feature is blocked by an actual missing schema capability or unavailable external integration, implement all independent supported parts and report the blocker precisely.

---

# PART 17 — FINAL COMPLETION REPORT

At the end, report:

1. Existing code reused.
2. Files created.
3. Files modified.
4. Four QR payload categories supported.
5. Barcode formats supported.
6. External URL handling implemented.
7. Data extraction implemented.
8. Manual fallback implemented.
9. Vaccination history collection implemented.
10. Source and verification labels implemented.
11. Database mapping implemented.
12. Second-scan lookup verified.
13. Duplicate cases handled.
14. Offline support status.
15. RFID removed from current UI/workflow.
16. Schema limitations, if any.
17. Tests actually executed and results.
18. Frontend build result.
19. Remaining blockers.

Never report a feature as completed unless it has actually been implemented and verified.

## FINAL BUSINESS RULE

The complete process must be:

**Existing QR/Barcode → Decode complete payload → Identify payload type → Inspect/extract available information → Open external link if relevant → Retrieve information only through authorized supported methods → Collect missing animal details from FW → Collect available historical vaccination information and its source → Verify and review → Check duplicates → Complete registration → Generate/use PashuRakshak Animal ID → Map the original existing tag → On the next scan, open the same animal and its complete stored history.**

The system must never assume that a QR contains all animal information, never invent missing information, never claim unverified history is official, and never allow an incomplete or invalid animal record to be silently registered. 