# AgriVoice — Team Collaboration & GitHub Workflow

This document governs code collaboration, repository hygiene, and feature branch workflows for the **five-member AgriVoice development team**.

---

## 1. Team Responsibilities & Ownership Matrix

| Team Member | Project Role | Availability | Primary Ownership Scope | Assigned Feature Branch |
|---|---|---|---|---|
| **Member 1 (Project Lead)** | Lead Architect & Core Engineer | Full | System architecture, Node/Fastify API foundation, PostgreSQL/PostGIS schemas & migrations, AI service architecture & workflows, Auth & security, core integrations, PR reviews & merging to `main`, deployment. | `main` (governance & integration) |
| **Member 2** | Frontend / Research Specialist | Moderate | **Comprehensive Agriculture Research & Extension UI** (`frontend/src/features/research/`): research/advisory content views, research result displays, evidence/source presentation, crop and agriculture-domain information interfaces, recommendation views, loading/error/empty states. | `feature/member2-research-ui` |
| **Member 3** | Frontend / Weather Specialist | Limited | **Weather & Crop Advisory UI** (`frontend/src/features/weather/`): weather forecast display, weather information cards, localized alerts, crop advisory display, responsive widgets, loading/error/empty states. | `feature/member3-weather-ui` |
| **Member 4** | Frontend / Institutions Specialist | Limited | **Institutions & Financial Inclusion UI** (`frontend/src/features/institutions/`): government scheme displays, insurance and financial information widgets, verified contact directories, institution/referral interfaces, loading/error/empty states. | `feature/member4-institutions-ui` |
| **Member 5** | Frontend / Soil & Input Specialist | Newly Added | **Soil & Input Verification UI** (`frontend/src/features/soil/`): soil report upload/interface, soil report result display, soil nutrient presentation, input verification UI, input/product verification result displays, history/record views, loading/error/empty/validation states. | `feature/member5-soil-ui` |

---

## 2. Core Git Collaboration Principles

1. **`main` Branch Protection Notice:** **Main branch protection is pending manual configuration by the repository owner in GitHub repository settings.** While branch protection rules have not yet been manually enabled, all team members are strictly required by team policy never to push feature work directly to `main`.
2. **Authentic Commits Only:** Every team member must make genuine commits from their own local workstation using their configured Git identity (`git config user.name` & `user.email`). No commits on behalf of others; no artificial contribution padding.
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
- Member 5 (Soil UI): `feature/member5-soil-ui`

```bash
# Example for Member 5
git checkout -b feature/member5-soil-ui
```

### Step 3: Local Development & Commits
Make incremental, clear commits following [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Stage modified files within your assigned feature folder
git add frontend/src/features/soil/

# Commit with a meaningful message
git commit -m "feat(soil-ui): add soil report upload card and nutrient indicator components"
```

### Step 4: Keep Branch Updated
Before pushing, rebase or merge from `main` to resolve conflicts early:

```bash
git checkout main
git pull origin main
git checkout feature/member5-soil-ui
git merge main
```

### Step 5: Push and Open Pull Request
```bash
# Push branch to remote
git push -u origin feature/member5-soil-ui
```
Then navigate to GitHub and open a **Pull Request** targeting `main` with:
- Summary of changes.
- Verification steps or screenshots.
- Identification of files modified.

---

## 5. Conflict Avoidance Guidelines

- Work strictly within your assigned feature directories under `frontend/src/features/<module>/`.
- Do not modify shared infrastructure (`docker-compose.yml`), root configurations, or backend modules unless coordinated with the Project Lead.
- Coordinate shared component additions in `frontend/src/components/shared/` or common types in `frontend/src/types/` prior to modification.
