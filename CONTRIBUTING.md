# Contributing to Volt

Thanks for your interest! Volt is in early development (Phase 1 — Simulator Core).

## Ground rules

- Read [PROJECT_PLAN.md](PROJECT_PLAN.md) first — scope decisions there are binding. Ideas outside v1 scope go to the v2 backlog, not PRs.
- All changes must pass `npm run typecheck` and `npm test`.
- Solver changes must include unit tests validated against known-correct values (hand calculation or SPICE).
- Work happens on feature branches; PRs target `main` and must pass CI.

## Setup

```bash
git clone https://github.com/robtim92/volt-app.git
cd volt-app
npm install
npm run dev:web
```
