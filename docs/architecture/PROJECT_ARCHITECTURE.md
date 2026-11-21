# AgriVoice — Project Architecture

## 1. Executive Summary & Vision

AgriVoice is an AI-powered, multilingual, voice-first agricultural assistance platform designed for real farmers across India. The platform bridges the rural digital divide by enabling farmers to interact naturally via phone calls or a responsive web interface in their regional language, receiving evidence-grounded, actionable agricultural guidance, market connectivity, machinery sharing, and institutional extension support.

---

## 2. Core Architectural Pillars

AgriVoice unifies six core agricultural domains into a single cohesive platform:

1. **Pillar 1: Hyper-Local Climate Resilience & Crop Advisory**
   - Precise location-aware meteorological forecasts and alerts.
   - Crop-stage weather advisory and preventive pest/disease forecasting.
   - Integration with Indian Meteorological Department (IMD) and verified weather providers.

2. **Pillar 2: Precision Soil Health & Input Verification**
   - Digitization and interpretation of Soil Health Cards (SHC) and soil test reports.
   - Crop-specific, soil-aware NPK and micronutrient recommendations.
   - Input retailer and distributor verification to combat counterfeit inputs.

3. **Pillar 3: Fair Market Access, MSP & Direct Buyer Connectivity**
   - Real-time Mandi market rates and Minimum Support Price (MSP) monitoring via Agmarknet / e-NAM data.
   - Verified buyer demand listings and direct farmer-to-buyer matching.
   - Privacy-preserving, consent-based call connectivity between farmers and verified buyers.

4. **Pillar 4: Farm Machinery Rental & Operator Integration**
   - Location-based discovery of tractors, harvesters, seeders, and implements.
   - Real-time equipment and operator availability matching.
   - Transparent booking workflows with local distance calculations.

5. **Pillar 5: Institutional Financial Inclusion & Agricultural Extension**
   - Discovery and eligibility matching for government welfare schemes (PM-KISAN, PMFBY).
   - Formal institutional credit guidance (Kisan Credit Card / KCC).
   - Direct routing and escalation to Krishi Vigyan Kendra (KVK) scientists and extension officers.

6. **Pillar 6: Comprehensive Agricultural & Aquacultural Research and Extension Hub**
   - Evidence-backed retrieval across agriculture, aquaculture, horticulture, floriculture, tuber crops, forestry, and rural livelihood domains.
   - Reliable research synthesis citing verified agricultural university and ICAR sources.
   - Uncertainty awareness with human expert escalation protocols.

---

## 3. System Architecture & Component Responsibilities

The system is organized into three decoupled primary tiers and an authoritative spatial database:

```text
               +-----------------------------------------+
               |           Frontend (React 19)           |
               |     Web UI / Mobile-responsive Views    |
               +--------------------+--------------------+
                                    | HTTPS / JSON
                                    v
               +--------------------+--------------------+
               |      Main Backend (Node.js/Fastify)     |
               |  API Gateway, Auth, DB Access, Business |
               +---------+--------------------+----------+
                         |                    |
        Internal HTTP    |                    | SQL / PostGIS
                         v                    v
+------------------------+-------+   +--------+------------------------+
|    AI Service (Python 3.12)    |   |     PostgreSQL 16 + PostGIS     |
| FastAPI, Language, Workflows,  |   | Authoritative Geospatial Data,  |
| Research Pipeline & Retrieval  |   | Profiles, Listings, Telemetry   |
+--------------------------------+   +---------------------------------+
```

### 3.1 Frontend Tier (`frontend/`)
- **Technology:** React 19, TypeScript, Vite, Tailwind CSS.
- **Responsibilities:**
  - Modern, responsive web user interface optimized for mobile viewports.
  - Farmer, buyer, operator, and administrative dashboards.
  - Form validation, client-side state, accessibility, and visual feedback (loading, error, empty states).
  - Centralized API communication through typed service clients.
- **Team Feature Module Ownership (Five-Member Team):**
  - **Member 2:** Comprehensive Agriculture Research & Extension UI (`frontend/src/features/research/`)
  - **Member 3:** Weather & Crop Advisory UI (`frontend/src/features/weather/`)
  - **Member 4:** Institutions & Financial Inclusion UI (`frontend/src/features/institutions/`)
  - **Member 5:** Soil Health & Input Verification UI (`frontend/src/features/soil/`)
  - **Project Lead (Member 1):** Shared UI components (`frontend/src/components/ui/`, `frontend/src/components/shared/`), router, layouts, context providers, and centralized API client.
- **Security Boundary:** The client is untrusted. All business rules and authorization must be validated server-side.

### 3.2 Main Application Backend (`backend/api/`)
- **Technology:** Node.js (>=20), Fastify, TypeScript.
- **Responsibilities:**
  - Single point of entry for client web requests and telephony webhooks.
  - Authentication and session management (Phone + OTP).
  - Farmer, buyer, and operator profile management.
  - Business transactions (marketplace orders, machinery bookings, consent records).
  - Authoritative database operations (migrations, seeds, queries).
  - Rate limiting, schema validation, and secure request forwarding to the AI service.
  - Integration clients (Telephony/Exotel, SMS, Meteorological APIs).

### 3.3 AI Service Tier (`backend/ai/`)
- **Technology:** Python 3.12, FastAPI, Pydantic v2, LangGraph (for complex state machines).
- **Responsibilities:**
  - Regional language processing, intent classification, and dialect normalization.
  - Structured advisory generation grounded in scientific evidence.
  - Shared **Research Pipeline** orchestration (ingestion, chunking, embeddings, hybrid search, evaluation).
  - Tool execution for agricultural calculations.
- **Security Boundary:** The AI service is an internal service. It cannot directly write to the business database or execute sensitive operations without validated backend authorization.

### 3.4 Data Tier (`backend/database/`)
- **Technology:** PostgreSQL 16 with PostGIS extension.
- **Responsibilities:**
  - Authoritative persistent data store.
  - Geospatial indexing (PostGIS `GEOMETRY(Point, 4326)`) for distance matching between farmers, mandis, weather stations, and farm machinery.
  - Relational integrity, constraints, and audit logging.
- **Infrastructure Note:** Redis is excluded from initial Phase 0 architecture to avoid unnecessary operational overhead. In-memory mechanisms within Fastify or direct database transactions suffice for MVP workloads.

---

## 4. The Research Pipeline Concept

The Research Pipeline (`backend/ai/app/research_pipeline/`) is a **shared internal capability**, not an independent user-facing pillar. It powers both Pillar 6 (Research Hub) and Pillar 1/2 advisory synthesis:
- **Sources:** ICAR packages of practices, State Agricultural University (SAU) publications, official extension advisories.
- **Ingestion & Processing:** Document extraction, cleaning, and semantic chunking.
- **Retrieval:** Hybrid lexical + vector search with metadata filtering (state, crop, agro-climatic zone).
- **Evaluation:** Faithfulness and hallucination checks prior to response synthesis.

---

## 5. User Authentication Architecture

Web and portal authentication adopts a streamlined, rural-friendly **Mobile Phone Number + OTP** architecture:

```text
Farmer/User           Backend API                 SMS / Telephony Gateway
    |                      |                                |
    | 1. Enter Phone #     |                                |
    |--------------------->| 2. Generate 6-digit OTP        |
    |                      |    Store hashed token & expiry |
    |                      |------------------------------->| 3. Send SMS OTP
    |                      |                                |---> User Phone
    | 4. Submit OTP        |                                
    |--------------------->| 5. Validate OTP                
    |                      |    Check expiry & attempts     
    |                      |                                
    |                      |--[ If New User ]--------------> Return { isNew: true }
    |                      |<------------------------------- Prompt Profile Creation
    | 6. Submit Profile    |
    | (Name, State, Dist,  |
    |  Mandal, Vill, PIN)  |
    |--------------------->| 7. Create User UUID & Profile
    |                      |    Issue JWT Session Token
    |                      |
    |                      |--[ If Existing User ]---------> Return JWT Session Token
    |<---------------------| 8. Authenticated Dashboard Session
```

### Key Principles:
1. **Identifier Separation:** The mobile phone number serves as the unique login credential, while an internal `UUID v4` acts as the permanent immutable primary key.
2. **Phone Normalization:** All phone numbers are strictly validated and normalized to E.164 format (`+91XXXXXXXXXX`).
3. **No Passwords:** To maximize usability for farmers, passwords and complex multi-factor challenges are eliminated for the MVP.
4. **Profile Completion:** Mandatory profile capture on first login (Name, State, District, Mandal, Village, PIN code). Profiles remain fully editable post-login.
5. **Session Management:** Secure HTTP-only cookies or signed bearer JWTs issued by the Fastify backend.
