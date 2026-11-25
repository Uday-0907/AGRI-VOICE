# AgriVoice — Pillar Implementation & Integration Conventions

This document defines mandatory standards for the parallel implementation of the six agricultural pillars by Members 2–5.

## 1. Module Boundaries & Ownership
All pillar-specific code must reside within `src/modules/<pillar-name>/`.
- **Core Entities:** Shared entities (Farmer, Farm, Field, Crop, Season) are owned by the Project Lead (`src/database/schema/`). Pillar teams MUST consume these schemas and associated API contracts; they must NOT modify shared database schemas or re-implement shared logic.
- **Pillar-Specific Schemas:** Pillar modules may define their own schemas inside their module directory, provided they reference shared foundational tables via foreign keys.
- **Migration Policy:** All schema changes (even pillar-specific tables) require Member 1 review. Pillar developers MUST coordinate migration generation with the Project Lead.

## 2. API Conventions
- **Contracts:** Use `TypeBox` schemas located in `src/common/validation/contracts.ts` for all shared requests/responses. Pillar-specific contracts should live in `src/modules/<pillar>/contracts.ts`.
- **Validation:** Every API route MUST validate input using the defined TypeBox schemas.
- **Error Handling:** Use centralized error handlers. Do not leak internal database errors or secrets to clients.
- **Ownership:** Every protected route MUST enforce ownership validation (`RequestUser.id` vs `OwnerID`).

## 3. Development Workflow
- **Branching:** Work exclusively on feature branches off `feature/integration`.
- **Pull Requests:** All PRs require Member 1 (Lead) approval.
- **Integration:** Pillar developers are responsible for integration tests verifying their pillar interacts correctly with the shared API foundation.
- **Documentation:** Every pillar module must include a `README.md` defining its API endpoints, external data dependencies, and acceptance criteria.

## 4. Database Governance
- **Shared Schema:** Canonical location is `src/database/schema/`. Do not create competing schema paths.
- **Migration:** All migrations must be forward-only and integrated into the shared migration history by Member 1.
