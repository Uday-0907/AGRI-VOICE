# AgriVoice

> **AI-Powered, Multilingual, Voice-First Agricultural Assistance Platform**

---

## 1. Project Overview & Mission

AgriVoice is designed as an accessible, reliable, and evidence-grounded agricultural assistance platform built specifically for real Indian farmers.

The central concept enables a farmer to dial a universal virtual phone number or access a mobile-responsive web portal in their preferred regional language. AgriVoice understands regional dialects and contexts, verifies local meteorological and soil health conditions, provides transparent Mandi and Minimum Support Price (MSP) information, matches farmers with equipment rentals and buyers, and synthesizes peer-reviewed agricultural extension research.

---

## 2. Six Core Pillars

1. **Hyper-Local Climate Resilience & Crop Advisory:** Micro-climate forecasts, extreme weather warnings, and crop-stage preventive guidance.
2. **Precision Soil Health & Input Verification:** Soil Health Card (SHC) interpretation, balanced NPK recommendations, and retailer verification.
3. **Fair Market Access, MSP & Direct Buyer Connectivity:** Transparent market rates, MSP data, and privacy-preserving buyer matching.
4. **Farm Machinery Rental & Operator Integration:** Discovery and booking of tractors, harvesters, and implements with location-based proximity.
5. **Institutional Financial Inclusion & Agricultural Extension:** Welfare scheme discovery (PM-KISAN, PMFBY), Kisan Credit Card guidance, and KVK scientist escalation.
6. **Comprehensive Agricultural & Aquacultural Research Hub:** Evidence-backed research synthesis across agriculture, aquaculture, horticulture, and allied rural livelihood domains.

---

## 3. Approved Architecture

- **Frontend (`frontend/`):** React 19, TypeScript, Vite, Tailwind CSS. Responsive web application with modular feature views.
- **Main Backend (`backend/api/`):** Node.js (>=20), Fastify, TypeScript. Central API gateway, Phone + OTP authentication, profile management, business transactions, database persistence, and external integrations.
- **AI Service (`backend/ai/`):** Python 3.12, FastAPI, LangGraph workflows, intent routing, and evidence-grounded research pipeline.
- **Data Layer (`backend/database/`):** PostgreSQL 16 with PostGIS spatial extension for proximity calculations.
- **Infrastructure (`infrastructure/`):** Docker & Docker Compose for isolated multi-service development.

---

## 4. Repository Structure

```text
AGRI-VOICE/
├── frontend/               # React 19 + TypeScript + Vite web client
│   ├── public/
│   ├── src/
│   │   ├── app/            # Routes, layouts, providers
│   │   ├── components/     # UI primitives and shared components
│   │   ├── features/       # Modular features (auth, weather, soil, markets, etc.)
│   │   ├── services/       # Centralized API client
│   │   ├── hooks/
│   │   ├── types/
│   │   ├── utils/
│   │   └── styles/
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── api/                # Fastify Node.js Application Backend
│   │   ├── src/
│   │   │   ├── app.ts
│   │   │   ├── server.ts
│   │   │   ├── config/
│   │   │   ├── plugins/
│   │   │   ├── common/     # Errors, validation, auth, utils
│   │   │   ├── modules/    # Domain modules (farmers, weather, markets, etc.)
│   │   │   └── integrations/ # Telephony, SMS, weather APIs
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── ai/                 # Python 3.12 FastAPI AI Service
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── config.py
│   │   │   ├── api/
│   │   │   ├── core/
│   │   │   ├── workflows/  # LangGraph state machine routers
│   │   │   ├── domains/    # Agricultural advisory domain handlers
│   │   │   ├── research_pipeline/ # Shared RAG pipeline (sources, ingestion, retrieval)
│   │   │   ├── tools/
│   │   │   ├── schemas/
│   │   │   └── services/
│   │   ├── tests/
│   │   ├── requirements.txt
│   │   └── pyproject.toml
│   │
│   └── database/           # PostgreSQL + PostGIS Schemas & Migrations
│       ├── migrations/
│       ├── schema/
│       ├── seeds/
│       └── README.md
│
├── docs/                   # Architecture, Development Plans, API Specs
│   ├── architecture/       # Detailed system architecture and decisions
│   ├── development-plan/   # Team workflow, checklists, roadmaps
│   ├── api/
│   ├── research/
│   ├── testing/
│   └── decisions/
│
├── infrastructure/         # Docker Compose and container configs
│   └── docker/
│
├── tests/                  # Cross-cutting end-to-end integration tests
│   └── integration/
│
├── scripts/                # Development, setup, and maintenance scripts
├── docker-compose.yml      # Local container orchestration (Postgres/PostGIS)
├── .env.example            # Sanitized environment template
├── .gitignore              # Ignore rules for secrets, builds, dependencies
├── README.md               # Project guide and constitution
└── LICENSE                 # Project licensing terms
```

---

## 5. Prerequisites & Environment Setup

### Prerequisites
- **Node.js:** `>= 20.x` (Recommended: v24 LTS)
- **Python:** `3.12.x` (Ensure `py -3.12` or `python3.12` is accessible)
- **Docker & Docker Compose:** Docker Desktop with WSL2 backend enabled
- **Git:** Standard git client

> [!IMPORTANT]
> **Component Readiness & Service Status in Phase 0:**
> - **Configured & Active Infrastructure:** Only the **PostgreSQL 16 + PostGIS** database container (`docker compose up -d postgres`) is configured and runnable at this stage.
> - **Scaffolded Skeletons (Not yet runnable):** Application code in `frontend/`, `backend/api/`, and `backend/ai/` consists strictly of directory scaffolding, configuration schemas, and type placeholders. Their service blocks in `docker-compose.yml` are deliberately commented out.
> - **Later Implementation Phases:** Application business logic, Fastify API endpoints, React views, AI LangGraph workflows, and Dockerfile container definitions will be built in subsequent milestones.
> - **Excluded Infrastructure:** Redis remains deliberately excluded from the initial architecture.

### Local Setup
1. **Clone the repository:**
   ```bash
   git clone https://github.com/Uday-0907/AGRI-VOICE.git
   cd AGRI-VOICE
   ```

2. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   # Review .env; the default credentials are for local development only
   ```

3. **Start Local Database (Only container active in Phase 0):**
   ```bash
   docker compose up -d postgres
   ```

---

## 6. Team Collaboration Workflow

AgriVoice is built by a **five-member development team** adhering to structured GitHub branching, strict module boundaries, and Pull Request reviews:

- **Branch Protection Notice:** **Main branch protection is pending manual configuration by the repository owner.** While GitHub branch protection rules have not yet been manually enabled in repository settings, all team members are strictly required by team policy never to push feature code directly to `main`.
- **Team Ownership & Feature Branches:**
  - **Member 1 (Project Lead):** Core architecture, backend foundation, database architecture/implementation, authentication & authorization, AI architecture & workflows, core integrations, security, system integration, code reviews and merging, deployment.
  - **Member 2 (Moderate availability):** Comprehensive Agriculture Research & Extension UI (`frontend/src/features/research/`) -> `feature/member2-research-ui`
  - **Member 3 (Limited availability):** Weather & Crop Advisory UI (`frontend/src/features/weather/`) -> `feature/member3-weather-ui`
  - **Member 4 (Limited availability):** Institutions & Financial Inclusion UI (`frontend/src/features/institutions/`) -> `feature/member4-institutions-ui`
  - **Member 5 (Newly added member):** Soil & Input Verification UI (`frontend/src/features/soil/`) -> `feature/member5-soil-ui`
- For complete operational guidelines on branch naming, commits, pull requests, and code reviews, refer to:  
  [docs/development-plan/TEAM_WORKFLOW.md](docs/development-plan/TEAM_WORKFLOW.md).

---

## 7. Current Project Status

> [!NOTE]
> **Status:** Phase 0 (Project Restructuring, Repository Governance & Team Setup) is **completed**.  
> The updated project architecture and team governance are finalized. Feature implementation has not yet started.
