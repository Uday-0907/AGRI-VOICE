# Pillar 6: Soil Health & Input Verification — Backend API Integration Guide

**Audience:** Member 5 (Frontend UI Lead for Pillar 6) & Member 1 (Project Lead)  
**Module Route Prefix:** `/soil`  
**Total Endpoints:** 10 (8 Web Application Endpoints + 2 Voice AI Operations)  
**Base URL:** `http://localhost:4000/soil` (Development)  
**Authentication:** Required on all endpoints. Header: `Authorization: Bearer <JWT_TOKEN>`. Requests without a valid JWT receive `401 Unauthorized`.  
**Farmer Ownership Rule:** All endpoints automatically bind to the authenticated caller's Farmer Profile (`assertFarmerContext`). Requesting cross-farmer records returns `404 Not Found` (fail-closed, IDOR-protected).  
**Demonstration / Demo Data Notice:** All demo fixtures and simulated catalog entries are synthetic reference samples. No real brand, manufacturer, or product is accused of regulatory violations or counterfeiting in demo mode.

---

## 1. Soil Health Dashboard

### `GET /soil/dashboard`
Returns the latest available soil test report, summary KPI counts, critical nutrient deficiencies, and recent test history.

- **Request:** No query/body parameters required.
- **Success Response (200 OK):**
```json
{
  "data": {
    "hasReport": true,
    "latestReport": {
      "id": "f0000000-0000-0000-0000-000000000099",
      "farmerId": "f0000000-0000-0000-0000-000000000001",
      "farmId": "fm000000-0000-0000-0000-000000000001",
      "fieldId": "fld00000-0000-0000-0000-000000000001",
      "cardId": "SHC-AP-1001",
      "reportId": "SHC-AP-1001",
      "source": "government_shc_api",
      "sourceAuthority": "Department of Agriculture, Govt of Andhra Pradesh",
      "sampleDate": "2026-04-12T05:00:00.000Z",
      "testingDate": "2026-04-20T10:00:00.000Z",
      "reportDate": "2026-04-25T08:30:00.000Z",
      "state": "Andhra Pradesh",
      "district": "Guntur",
      "mandal": "Tenali",
      "village": "Kollipara",
      "soilType": "black_cotton",
      "ph": 7.5,
      "ec": 0.4,
      "organicCarbon": 0.55,
      "nitrogen": 190.0,
      "phosphorus": 25.0,
      "potassium": 320.0,
      "sulphur": 14.2,
      "zinc": 0.6,
      "iron": 5.8,
      "copper": 1.1,
      "manganese": 4.5,
      "boron": 0.5,
      "nutrientRatings": {
        "nitrogen": "LOW",
        "phosphorus": "MEDIUM",
        "potassium": "HIGH",
        "zinc": "DEFICIENT"
      },
      "recommendations": [
        {
          "crop": "Paddy / Rice",
          "fertilizer": "Urea",
          "dosageKgPerAcre": 45,
          "note": "Apply in 3 splits (basal, tillering, panicle initiation)"
        },
        {
          "crop": "Paddy / Rice",
          "fertilizer": "Zinc Sulphate (21%)",
          "dosageKgPerAcre": 10,
          "note": "Apply as basal dose"
        }
      ],
      "status": "available",
      "isDemo": "false",
      "createdAt": "2026-04-25T08:30:00.000Z",
      "updatedAt": "2026-04-25T08:30:00.000Z"
    },
    "summary": {
      "totalReports": 3,
      "lastTestedDate": "2026-04-20T10:00:00.000Z",
      "primarySoilType": "black_cotton",
      "overallStatus": "available",
      "availableNutrientCount": 11,
      "criticalDeficiencies": ["nitrogen", "zinc"]
    },
    "recentReports": [...]
  }
}
```

- **Empty State Response (200 OK):** When farmer has no reports on file:
```json
{
  "data": {
    "hasReport": false,
    "latestReport": null,
    "summary": {
      "totalReports": 0,
      "lastTestedDate": null,
      "primarySoilType": null,
      "overallStatus": "NOT_REQUESTED",
      "availableNutrientCount": 0,
      "criticalDeficiencies": []
    },
    "recentReports": []
  }
}
```

---

## 2. Soil Health Card Lookup & Import

### `POST /soil/lookup`
Initiates lookup against the national Soil Health Card registry (`soilhealth.dac.gov.in`) or demo provider adapter and persists normalized data.

- **Request Body (application/json):**
```json
{
  "cardId": "SHC-AP-1001",
  "farmId": "optional-uuid-of-farm",
  "fieldId": "optional-uuid-of-field",
  "providerMode": "auto" // 'auto' | 'government' | 'demo'
}
```
- **Validation Constraints:**
  - `cardId`: string, minLength 3, maxLength 64.
  - `farmId`: optional UUID (must be owned by the calling farmer; otherwise 403 Forbidden).
  - `fieldId`: optional UUID (must belong to the exact specified farm owned by the calling farmer; otherwise 403 Forbidden).
  - `providerMode`: optional (`'auto'` | `'government'` | `'demo'`). In local development, defaults to `'demo'` if `GOV_DATA_API_KEY` is unset.
- **Success Response (201 Created):** Returns the normalized, persisted `SoilReportResponse` entity.
- **Failure Responses:**
  - `400 Bad Request`: Validation failure (e.g. cardId too short).
  - `403 Forbidden`: Cross-farmer farm/field ID submitted or field does not belong to the requested farm.
  - `503 Service Unavailable`: Upstream national portal offline (returns structured `status: "provider_unavailable"` report).

---

## 3. Soil Report Management

### `GET /soil/reports`
Lists historical soil reports with pagination and optional filtering by farm or field.

- **Query Parameters:**
  - `limit`: integer, 1 to 100 (default: 20).
  - `offset`: integer, >= 0 (default: 0).
  - `farmId`: optional UUID.
  - `fieldId`: optional UUID.
- **Success Response (200 OK):**
```json
{
  "data": [ ... reports array ... ],
  "meta": {
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 3
    },
    "timestamp": "2026-11-24T09:30:00.000Z"
  }
}
```

### `GET /soil/reports/:id`
Retrieves full details of a specific soil report by ID.

- **Path Parameter:** `id` (UUID).
- **Security:** Returns `404 Not Found` if the report does not exist or belongs to another farmer.
- **Success Response (200 OK):** `{ "data": { ... SoilReportResponse ... } }`.

### `POST /soil/reports/:id/refresh`
Re-queries the provider using the report's `cardId` and persists a new updated version without deleting historical reports.

- **Path Parameter:** `id` (UUID).
- **Success Response (200 OK):** `{ "data": { ... UpdatedSoilReportResponse ... } }`.

---

## 4. Agricultural Input & Product Verification

### `POST /soil/inputs/verify`
Verifies a seed, fertilizer, or pesticide against CIBRC / FCO regulatory databases or test demonstration catalog.

- **Request Body (application/json):**
```json
{
  "productName": "DemoBio Complex NPK 20-20-20",
  "category": "fertilizer", // 'fertilizer' | 'seed' | 'pesticide' | 'bio_stimulant' | 'other'
  "brand": "DemoBio Complex NPK 20-20-20 (Synthetic Sample)",
  "manufacturer": "Demo Agrochemicals Lab Ltd (Fictional Entity)",
  "batchNumber": "DEMO-FERT-NPK-001",
  "registrationNumber": "DEMO-REG-FCO-2026-001",
  "providerMode": "demo" // 'auto' | 'official' | 'demo'
}
```
- **Verification Status Values (`verificationStatus`):**
  - `verified`: Active, certified registry entry (Official mode only with live provider evidence).
  - `not_found`: No matching registry record (Note: UI must clearly explain this does not prove counterfeit; manual check with Mandal Agriculture Officer advised).
  - `expired`: Product batch past official shelf-life (Official mode only).
  - `recall_alert`: Official agricultural department vigilance/recall warning (Official mode only).
  - `inconclusive`: Manufacturer registered, but batch certificate unconfirmed.
  - `provider_unavailable`: Registry gateway credentials offline.
  - `demo`: Synthetic test demonstration data. All demo mode queries return `status: "demo"` with explicit disclaimers in `evidence` and `notes`. Never produces official regulatory claims.
- **Success Response (201 Created) — Demo Mode Example:**
```json
{
  "data": {
    "id": "v0000000-0000-0000-0000-000000000001",
    "farmerId": "f0000000-0000-0000-0000-000000000001",
    "productName": "DemoBio Complex NPK 20-20-20",
    "category": "fertilizer",
    "brand": "DemoBio Complex NPK 20-20-20 (Synthetic Sample)",
    "manufacturer": "Demo Agrochemicals Lab Ltd (Fictional Entity)",
    "batchNumber": "DEMO-FERT-NPK-001",
    "registrationNumber": "DEMO-REG-FCO-2026-001",
    "verificationStatus": "demo",
    "provider": "demo_input_registry",
    "evidence": {
      "isDemo": true,
      "simulatedScenario": "registered_sample",
      "disclaimer": "DEMONSTRATION SAMPLE ONLY: This record was generated in a local test catalog. It does not represent an official regulatory finding or government registry verification.",
      "licensedManufacturer": "Demo Agrochemicals Lab Ltd (Fictional Entity)",
      "registeredFormula": "DemoBio Complex NPK 20-20-20 (Synthetic Sample)",
      "validUntil": "2028-12-31",
      "targetCrops": ["Paddy", "Chilli", "Cotton", "Maize"],
      "officialNotice": "DEMONSTRATION SAMPLE ONLY: Fictional reference formulation for testing. Not an official regulatory determination."
    },
    "notes": "DEMONSTRATION SAMPLE ONLY: Fictional reference formulation for testing. Not an official regulatory determination.",
    "createdAt": "2026-11-24T09:30:00.000Z"
  }
}
```

### `GET /soil/inputs/verifications`
Lists farmer's verification history with pagination metadata (`meta.pagination`).

### `GET /soil/inputs/verifications/:id`
Retrieves a single input verification result with ownership enforcement.

---

## 5. Voice AI Backend Tool Integrations

The Voice AI phone-call gateway interfaces with the following operations using shared services:

### `GET /soil/voice/context`
- Returns verified farmer location, report availability, data freshness in days, nutrient readings (with units and nulls preserved), missing nutrient array, and anti-hallucination guidance constraints.

### `POST /soil/voice/verify-input`
- Verifies products submitted verbally during a call and returns plain-text guidance summaries suitable for speech output without fabricating claims.
