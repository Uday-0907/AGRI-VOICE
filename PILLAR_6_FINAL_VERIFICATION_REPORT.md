# WA3.2 — Pillar 6 (Soil Health & Input Verification) Final Verification Report

**Project:** AgriVoice  
**Pillar:** Pillar 6 — Soil Health & Input Verification  
**Repository:** `C:\dev\AGRI-VOICE`  
**Branch:** `feature/integration`  
**Previous Completion Commit:** `17ad1f1`  
**Verification Date:** 2026-11-24  

---

## 1. Executive Summary

Pillar 6 (Soil Health & Input Verification) has undergone a comprehensive, deep audit and defect-closure pass. All functional workflows—encompassing Soil Health Card retrieval, data normalization, database persistence, dashboard/history/refresh APIs, agricultural input verification, Voice AI phone-call tools, and server-side ownership enforcement—have been completely implemented, integrated, and verified against the PostgreSQL database and automated test suites.

**Key Findings:**
1. **Migration 0002 Spatial Constraints:** The original migration 0002 draft attempted redundant DROP/ADD cycles for spatial check constraints (`chk_farms_location_valid`, `chk_fields_location_valid`, `chk_fields_boundary_valid`) because Drizzle metadata snapshot `0001_snapshot.json` had recorded the initial non-null check. The snapshot metadata was synchronized with the applied migration `0001_integrity_constraints.sql`, and `0002_pillar_6_soil_foundation.sql` was cleaned to contain only true forward operations. Migration 0002 applied cleanly to PostgreSQL and was verified.
2. **Database Port Verification:** The database target `localhost:5433` is the deliberate Docker container port mapping defined in `.env` (`POSTGRES_PORT=5433`), avoiding collision with an independent native Windows PostgreSQL service running on port `5432`.
3. **Voice AI Orchestration Tools:** Implemented explicit Voice AI tool definitions (`createSoilVoiceTools`) in `src/modules/soil/voice-tools.ts` with strict JSON Schema parameter validation and verified caller session binding (`session.userId`), ensuring Voice AI cannot hallucinate readings or bypass authorization.
4. **Synthetic Demo Safety:** Replaced institutional attribution and brand names in demo catalogs with explicit synthetic demonstration labels, ensuring no real manufacturer or brand is falsely accused of counterfeiting.
5. **Automated Testing:** 39 tests across 6 suites are fully passing with zero regressions.

---

## 2. Initial Repository and Git Baseline

- **Current Branch:** `feature/integration`
- **Baseline Commit Preserved:** `17ad1f1` (`feat(pillar-6): complete soil health and input verification backend implementation`)
- **Preceding Foundation Commit:** `f38d71a` (`chore: complete WA3.1 backend foundation integration`)
- **Remote Policy:** No pushes to remote and no merges into `main` were performed.
- **Database Identity:**
  - Host: `localhost`
  - Port: `5433` (Docker container `agrivoice-postgres`)
  - Database: `agrivoice`
  - Engine: PostgreSQL 16.1 + PostGIS 3.4.3
  - Applied Migrations: `0000_init`, `0001_integrity_constraints`, `0002_pillar_6_soil_foundation` (all 3 recorded in `drizzle.__drizzle_migrations`)

---

## 3. Migration 0002 Audit & Spatial Constraint Reconciliation

### 3.1 Constraint Comparison Table

| Constraint | Migration 0000 | Migration 0001 (Applied) | PostgreSQL Catalog (`pg_constraint`) | Migration 0002 (Corrected) | Status |
|---|---|---|---|---|---|
| `chk_farms_location_valid` | Absent | NULL-safe Point check: `location IS NULL OR (NOT ST_IsEmpty(location) AND ST_X(location) BETWEEN -180 AND 180 AND ST_Y(location) BETWEEN -90 AND 90)` | `CHECK (((location IS NULL) OR ((NOT st_isempty(location)) AND (st_x(location) BETWEEN -180 AND 180)...)))` | Preserved as-is (Redundant DROP/ADD removed) | **PASS** |
| `chk_fields_location_valid` | Absent | NULL-safe Point check: `location IS NULL OR (NOT ST_IsEmpty(location) AND ST_X(location) BETWEEN -180 AND 180 AND ST_Y(location) BETWEEN -90 AND 90)` | `CHECK (((location IS NULL) OR ((NOT st_isempty(location)) AND (st_x(location) BETWEEN -180 AND 180)...)))` | Preserved as-is (Redundant DROP/ADD removed) | **PASS** |
| `chk_fields_boundary_valid` | Absent | NULL-safe Polygon check: `boundary IS NULL OR (ST_IsValid(boundary) AND NOT ST_IsEmpty(boundary))` | `CHECK (((boundary IS NULL) OR (st_isvalid(boundary) AND (NOT st_isempty(boundary)))))` | Preserved as-is (Redundant DROP/ADD removed) | **PASS** |

### 3.2 Root Cause & Resolution
- **Root Cause:** In Phase 1, `0001_integrity_constraints.sql` was manually corrected for NULL-safety, but Drizzle snapshot `0001_snapshot.json` retained the previous non-null SQL check. When generating migration 0002, Drizzle-kit detected a diff between the schema and snapshot, prompting it to generate drop-and-add statements for identical constraints.
- **Correction:** Synchronized `0001_snapshot.json` to record the exact NULL-safe expressions. Removed redundant DROP/ADD operations from `0002_pillar_6_soil_foundation.sql`.
- **Execution Evidence:** `npm run db:migrate` executed without error; `drizzle.__drizzle_migrations` records migration 0002 with hash `551ddaaaf06794a0b7e2eeefa474f5a41590c2483f1283c559970010dce27ffa`.
- **Integrity:** `drizzle-kit check` reports `Everything's fine 🐶🔥`. Existing farm and field records remain untouched.

---

## 4. Database Schema & Persistence Audit

### 4.1 `soil_reports` Table
- **Columns (34):**
  - Primary Key: `id` (`uuid`, `gen_random_uuid()`)
  - Ownership: `farmer_id` (`uuid`, FK -> `farmer_profiles.id`, `ON DELETE restrict`, NOT NULL)
  - Associations: `farm_id` (`uuid`, FK -> `farms.id`, `ON DELETE cascade`, NULLABLE), `field_id` (`uuid`, FK -> `fields.id`, `ON DELETE cascade`, NULLABLE)
  - Provenance: `card_id` (`varchar(64)`), `report_id` (`varchar(128)`, NOT NULL), `source` (`varchar(64)`, NOT NULL), `source_authority` (`varchar(128)`)
  - Temporal: `sample_date`, `testing_date`, `report_date` (all `timestamptz`, `report_date` NOT NULL)
  - Location: `state`, `district`, `mandal`, `village`, `soil_type` (all `varchar(64)`)
  - Chemical Readings: `ph` (numeric 4,2), `ec` (numeric 6,3), `organic_carbon` (numeric 5,2)
  - Macronutrients: `nitrogen` (numeric 10,2), `phosphorus` (numeric 10,2), `potassium` (numeric 10,2), `sulphur` (numeric 10,2)
  - Micronutrients: `zinc`, `iron`, `copper`, `manganese`, `boron` (all numeric 8,2)
  - Structured Metadata: `nutrient_ratings` (`jsonb`), `recommendations` (`jsonb`)
  - Lifecycle: `status` (`varchar(32)`, default `'available'`), `is_demo` (`varchar(16)`, default `'false'`)
  - Timestamps: `created_at`, `updated_at` (`timestamptz`, NOT NULL)
- **Indexes:** `idx_soil_reports_farmer`, `idx_soil_reports_field`, `idx_soil_reports_farm`, `idx_soil_reports_card_id`
- **Constraints:** `chk_soil_ph` (`ph IS NULL OR (ph >= 0 AND ph <= 14)`), `chk_soil_status` (`IN ('available', 'pending', 'partial', 'not_found', 'failed', 'provider_unavailable', 'demo')`)

### 4.2 `input_verifications` Table
- **Columns (13):**
  - Primary Key: `id` (`uuid`, `gen_random_uuid()`)
  - Ownership: `farmer_id` (`uuid`, FK -> `farmer_profiles.id`, `ON DELETE restrict`, NOT NULL)
  - Product Attributes: `product_name` (`varchar(256)`, NOT NULL), `category` (`varchar(64)`, NOT NULL), `brand` (`varchar(128)`), `manufacturer` (`varchar(128)`), `batch_number` (`varchar(128)`), `registration_number` (`varchar(128)`)
  - Verification: `verification_status` (`varchar(32)`, NOT NULL), `provider` (`varchar(64)`, NOT NULL), `evidence` (`jsonb`), `notes` (`varchar(512)`), `created_at` (`timestamptz`, NOT NULL)
- **Indexes:** `idx_input_verifications_farmer`, `idx_input_verifications_batch`
- **Constraints:** `chk_input_category` (`IN ('fertilizer', 'seed', 'pesticide', 'bio_stimulant', 'other')`), `chk_input_verification_status` (`IN ('verified', 'not_verified', 'inconclusive', 'not_found', 'expired', 'recall_alert', 'provider_unavailable', 'demo')`)

---

## 5. Provider Reality & Integration Assessment

| Provider Component | Implementation Location | Official API Documented? | Credentials in Env? | Real Upstream Tested? | Safe Truthful Behavior When Unconfigured |
|---|---|---|---|---|---|
| **Government Soil Health Card Provider** | `src/modules/soil/providers/gov-shc.provider.ts` | Yes (`soilhealth.dac.gov.in`) | No (placeholder in `.env.example`) | Blocked (No live credentials) | Returns `provider_unavailable` status with informative error message; never fabricates live data. |
| **Demo Soil Health Card Provider** | `src/modules/soil/providers/mock-shc.provider.ts` | N/A (Synthetic demo adapter) | N/A | Yes (Unit tested) | Returns realistic Telangana/AP black cotton soil readings explicitly stamped with `isDemo: true`, `source: "demo_mock_provider"`, `status: "demo"`. Source authority labeled as `AgriVoice Demo Soil Testing Laboratory`. |
| **National Input Registry Provider (CIBRC / FCO)** | `src/modules/soil/providers/national-input.provider.ts` | Yes (CIBRC / FCO gazette) | No (placeholder) | Blocked (No live credentials) | Returns `provider_unavailable` status; never fabricates verified certificates. |
| **Demo Input Verification Provider** | `src/modules/soil/providers/mock-input.provider.ts` | N/A (Synthetic demo adapter) | N/A | Yes (Unit tested) | Returns synthetic reference products. All alert/recall fixtures are labeled as `Synthetic Demonstration Record` to prevent accusing real entities. |

---

## 6. Route & Endpoint Inventory (Exact Count: 10)

All 10 endpoints are registered in `src/modules/soil/routes.ts` under prefix `/soil`:

| # | Method | Path | Target & Audience | Description |
|---|---|---|---|---|
| 1 | `GET` | `/soil/dashboard` | Web (Member 5) | Returns latest report, summary KPI counts, critical deficiencies, and test history. |
| 2 | `POST` | `/soil/lookup` | Web (Member 5) | Initiates Soil Health Card lookup and persists normalized data. |
| 3 | `GET` | `/soil/reports` | Web (Member 5) | Paginated list of soil reports with optional `farmId`/`fieldId` filters. |
| 4 | `GET` | `/soil/reports/:id` | Web (Member 5) | Single report details by ID with farmer ownership enforcement. |
| 5 | `POST` | `/soil/reports/:id/refresh` | Web (Member 5) | Re-queries provider using `cardId` without destroying historical versions. |
| 6 | `POST` | `/soil/inputs/verify` | Web (Member 5) | Submits agricultural input for regulatory verification and stores history. |
| 7 | `GET` | `/soil/inputs/verifications` | Web (Member 5) | Paginated list of farmer's input verification history. |
| 8 | `GET` | `/soil/inputs/verifications/:id` | Web (Member 5) | Single input verification detail with ownership enforcement. |
| 9 | `GET` | `/soil/voice/context` | Voice AI (Phone Calls) | Returns verified farmer context, data freshness in days, nutrient readings with nulls preserved, missing nutrient list, and anti-hallucination guidance. |
| 10 | `POST` | `/soil/voice/verify-input` | Voice AI (Phone Calls) | Verifies product verbally submitted during telephone flow and returns speech-friendly summary. |

---

## 7. Voice AI Orchestration Tools

In addition to HTTP endpoints, Pillar 6 exports standard Voice AI tool definitions via `src/modules/soil/voice-tools.ts`:
1. `get_farmer_soil_health_context`: Bound to trusted `session.userId`.
2. `verify_agricultural_input_product`: Validates arguments (`productName`, `category`, `brand`, `batchNumber`) via JSON Schema and invokes shared services.

**Anti-Hallucination Controls:**
- If nutrient data is missing, the backend returns `null` and populates `missingMeasurements: ['zinc', 'iron', ...]`.
- Injected `aiGuidance`: *"State only the verified readings listed in nutrients. The test report is X days old. If a nutrient is in missingMeasurements, state that it was not tested. Do not invent fertilizer doses."*
- Unverified products or missing batch numbers return `not_found` with explicit disclaimer that absence of record alone does not prove counterfeit.

---

## 8. Security & Authorization Enforcement Audit

| Check | Route / Service Location | Verification Result |
|---|---|---|
| JWT Authentication | `src/modules/soil/routes.ts` (`preHandler` hook) | Requests without valid JWT receive `401 Unauthorized` (`FST_JWT_NO_AUTHORIZATION_IN_HEADER`). |
| Farmer Context Resolution | `assertFarmerContext` in `src/common/auth/ownership.ts` | Users without active `farmer_profiles` fail closed with `403 Forbidden`. |
| Cross-Farmer Soil Report IDOR | `SoilReportService.getReportById` | Query includes `WHERE id = $id AND farmer_id = $callerFarmerId`. Non-owned report returns `404 Not Found`. |
| Cross-Farmer Refresh IDOR | `SoilReportService.refreshReport` | Non-owned report returns `404 Not Found`. |
| Cross-Farmer Input Verification IDOR | `InputVerificationService.getVerificationById` | Query includes `WHERE id = $id AND farmer_id = $callerFarmerId`. Non-owned record returns `404 Not Found`. |
| Farm / Field Ownership Mismatch | `SoilReportService.lookupAndSaveCard` | Associating another farmer's `farmId` or `fieldId` triggers `403 Forbidden`. |
| Voice Session Identity Spoofing | `createSoilVoiceTools` (`execute` handler) | Unverified session (`session.userId` missing) throws `UNAUTHORIZED_CALLER_SESSION`. |

---

## 9. Automated Testing & Verification Audit

- **Test Framework:** Vitest 5.1.1 configured with `vitest.config.ts`.
- **Test Command:** `npm test` / `npx vitest run` in `backend/api`.
- **Test Result:** **6 test files passed, 39 tests passed, 0 failed, 0 skipped.**

```text
 ✓ tests/modules/soil/voice-tools.test.ts (5 tests)
 ✓ tests/modules/soil/input-verification-provider.test.ts (7 tests)
 ✓ tests/modules/soil/shc-provider.test.ts (5 tests)
 ✓ tests/modules/soil/soil-voice.test.ts (4 tests)
 ✓ tests/modules/soil/soil-security.test.ts (5 tests)
 ✓ tests/modules/soil/soil-api.test.ts (13 tests)

 Test Files  6 passed (6)
      Tests  39 passed (39)
   Start at  09:52:14
   Duration  1.70s
```

---

## 10. Requirement-by-Requirement Completion Matrix

| Requirement | Implementation Location | Verification Method | Status |
|---|---|---|---|
| Modular Fastify registration | `src/app.ts`, `src/plugins/module-registry.ts` | Route table inspection | **PASS** |
| Soil Health Card schema | `src/database/schema/soil.ts` | PostgreSQL DDL query (`\d soil_reports`) | **PASS** |
| Input Verification schema | `src/database/schema/soil.ts` | PostgreSQL DDL query (`\d input_verifications`) | **PASS** |
| SHC Provider abstraction | `src/modules/soil/providers/shc-provider.interface.ts` | TypeScript interface | **PASS** |
| Truthful government integration adapter | `src/modules/soil/providers/gov-shc.provider.ts` | Unit test in `shc-provider.test.ts` | **PASS** |
| Synthetic demonstration SHC adapter | `src/modules/soil/providers/mock-shc.provider.ts` | Unit test in `shc-provider.test.ts` | **PASS** |
| Soil lookup & normalization workflow | `SoilReportService.lookupAndSaveCard` | Integration test in `soil-api.test.ts` | **PASS** |
| Soil Dashboard API | `GET /soil/dashboard` | Integration test in `soil-api.test.ts` | **PASS** |
| Soil Report Details API | `GET /soil/reports/:id` | Integration test in `soil-api.test.ts` | **PASS** |
| Soil Report History API | `GET /soil/reports` | Integration test in `soil-api.test.ts` | **PASS** |
| Soil Report Refresh API | `POST /soil/reports/:id/refresh` | Integration test in `soil-api.test.ts` | **PASS** |
| Input Verification provider abstraction | `src/modules/soil/providers/input-verification-provider.interface.ts` | TypeScript interface | **PASS** |
| Truthful national input registry adapter | `src/modules/soil/providers/national-input.provider.ts` | Unit test in `input-verification-provider.test.ts` | **PASS** |
| Synthetic demonstration input adapter | `src/modules/soil/providers/mock-input.provider.ts` | Unit test in `input-verification-provider.test.ts` | **PASS** |
| Input Verification APIs | `POST /soil/inputs/verify`, `GET /soil/inputs/verifications` | Integration test in `soil-api.test.ts` | **PASS** |
| Canonical TypeBox contracts | `src/modules/soil/contracts.ts` | Validation test in `soil-api.test.ts` | **PASS** |
| Server-side farmer ownership checks | `src/common/auth/ownership.ts` | Security tests in `soil-security.test.ts` | **PASS** |
| Cross-farmer IDOR prevention | `src/modules/soil/services/soil-report.service.ts` | Security tests in `soil-security.test.ts` | **PASS** |
| Voice AI context & speech APIs | `GET /soil/voice/context`, `POST /soil/voice/verify-input` | Integration test in `soil-api.test.ts` | **PASS** |
| Voice AI tool definitions | `src/modules/soil/voice-tools.ts` | Unit test in `voice-tools.test.ts` | **PASS** |
| Anti-hallucination boundaries | `SoilVoiceService.getVoiceSoilContext` | Unit test in `soil-voice.test.ts` | **PASS** |
| Safe forward migration 0002 | `backend/database/migrations/0002_pillar_6_soil_foundation.sql` | `npm run db:migrate` in PostgreSQL | **PASS** |
| Migration snapshot synchronization | `backend/database/migrations/meta/0001_snapshot.json` | `drizzle-kit check` | **PASS** |
| Member 5 API integration guide | `src/modules/soil/PILLAR_6_API_GUIDE.md` | Document review | **PASS** |

---

## 11. Remaining Limitations & Blockers
- **Live Government API Credentials:** National Soil Health Card API (`GOV_DATA_API_KEY`) and CIBRC registry API (`INPUT_REGISTRY_API_KEY`) are not configured in the local developer environment. The system behaves truthfully by returning `provider_unavailable` when requested in official mode, and seamlessly supports local development via explicit `providerMode: "demo"`. **This does not block Member 5 UI implementation.**
- **Voice Telephony Webhooks:** The low-level telephony provider integration (Exotel/telephony webhooks) is scheduled for Stage 6 of Phase 3. The Pillar 6 backend Voice AI service and tool definitions are fully operational and ready to be bound by the incoming call session dispatcher.

---

## 12. Final Readiness Verdict

**READY WITH DOCUMENTED EXTERNAL LIMITATIONS**

The backend for Pillar 6 (Soil Health & Input Verification) is complete, robust, secure, and covered by 39 passing automated tests. Member 5 can commence frontend UI implementation immediately using the contracts in `backend/api/src/modules/soil/PILLAR_6_API_GUIDE.md`.
