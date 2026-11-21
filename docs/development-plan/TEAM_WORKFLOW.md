# AgriVoice — Team Collaboration & GitHub Workflow

This document governs code collaboration, repository hygiene, and feature branch workflows for the **four-member AgriVoice development team**.

---

## 1. Team Responsibilities & Ownership Matrix

| Team Member | Project Role | Availability | Primary Ownership Scope |
|---|---|---|---|
| **Project Lead** | Lead Architect & Core Engineer | Full | System architecture, Node/Fastify API foundation, PostgreSQL/PostGIS schemas, AI service architecture, Auth & security, external integrations, PR reviews & merging to `main`. |
| **Member 2** | Frontend / Research Specialist | Moderate | Comprehensive Agriculture Research & Extension UI (`frontend/src/features/research/`), research exploration views. |
| **Member 3** | Frontend / Weather Specialist | Limited | Weather & Crop Advisory UI (`frontend/src/features/weather/`), localized climate alerts and charts. |
| **Member 4** | Frontend / Institutions Specialist | Limited | Institutions & Financial Inclusion UI (`frontend/src/features/institutions/`), government schemes and KVK directory views. |

---

## 2. Core Git Collaboration Principles

1. **`main` Branch Protection:** The `main` branch represents deployable, stable code. No team member pushes feature work directly to `main`.
2. **Authentic Commits Only:** Every team member must make genuine commits from their own local workstation using their configured Git identity. No commits on behalf of others; no artificial contribution padding.
3. **Isolated Feature Branches:** Each member develops exclusively in dedicated feature branches branched off latest `main`.
4. **Small, Atomic Pull Requests:** Keep Pull Requests focused on assigned module boundaries to minimize merge conflicts.
5. **Code Review & Integration:** The Project Lead reviews all Pull Requests, verifies linting/tests, and merges approved contributions.

---

## 3. Git Configuration Setup

Before creating branches, each team member must configure their Git name and email on their local workstation:

```bash
git config --global user.name "Your Full Name"
git config --global user.email "your.email@example.com"
```

---

## 4. Standard Feature Branch Workflow

### Step 1: Clone and Synchronize
```bash
# Clone the repository
git clone https://github.com/Uday-0907/AGRI-VOICE.git
cd AGRI-VOICE

# Verify remote configuration
git remote -v

# Ensure main branch is up to date
git checkout main
git pull origin main
```

### Step 2: Create a Feature Branch
Use standardized branch naming conventions:

- Member 2 (Research UI): `feature/member2-research-ui`
- Member 3 (Weather UI): `feature/member3-weather-ui`
- Member 4 (Institutions UI): `feature/member4-institutions-ui`

```bash
# Example for Member 2
git checkout -b feature/member2-research-ui
```

### Step 3: Local Development & Commits
Make incremental, clear commits following [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Stage modified files
git add frontend/src/features/research/

# Commit with a meaningful message
git commit -m "feat(research-ui): add research search bar and result list components"
```

### Step 4: Keep Branch Updated
Before pushing, rebase or merge from `main` to resolve conflicts early:

```bash
git checkout main
git pull origin main
git checkout feature/member2-research-ui
git merge main
```

### Step 5: Push and Open Pull Request
```bash
# Push branch to remote
git push -u origin feature/member2-research-ui
```
Then navigate to GitHub and open a **Pull Request** targeting `main` with:
- Summary of changes.
- Screenshots or verification steps.
- Identification of files modified.

---

## 5. Conflict Avoidance Guidelines

- Work strictly within your assigned feature directories under `frontend/src/features/<module>/`.
- Do not modify shared infrastructure (`docker-compose.yml`), root configurations, or backend modules unless coordinated with the Project Lead.
- Coordinate shared component additions in `frontend/src/components/shared/` or common types in `frontend/src/types/` prior to modification.
