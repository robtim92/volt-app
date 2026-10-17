# Volt — New Session Initialization Prompt

> Paste the block below as your first message in a new Cowork session.

---

## PROMPT

We are continuing development on **Volt** — a free, open-source educational electronics simulator (comparable to VoltSim / EveryCircuit). The project lives at `C:\Apps\electronics-simulator` and the GitHub repo is `robtim92/volt-app`.

Please read the following files in order before doing anything else:

1. `C:\Apps\electronics-simulator\DEV_LOG.md` — full milestone history and current roadmap
2. `C:\Apps\electronics-simulator\PROJECT_PLAN.md` — authoritative scope, architecture, and phase definitions

### Current status (as of June 13, 2026)

- **Phase 0 ✅** Foundation (git, CI, stack)
- **Phase 1 ✅** Simulator core (MNA solver, canvas sandbox, save/load, pan/zoom, meters)
- **Phase 2 ✅** Lesson engine (8 DC lessons, card player, quiz scoring, soft-gate completion, dashboard, onboarding quiz)
- **Phase 3 🚧 partial** (commit `4bb91ba`) — circuit-completion quiz system shipped; see DEV_LOG.md

### What to do next (Phase 3 — remaining items)

Pick up Phase 3 where it left off. The next items in priority order:

**1. Spaced-repetition review queue**
Surface a daily review queue in the Dashboard based on lesson quiz scores and time elapsed. SM-2-style: lessons with score < 70% or not revisited in N days float to the top. Add a "Review today" section to `DashboardPanel.tsx` (separate from the existing "Needs Review" section, which is static). Store scheduling metadata in `lessonStore` (persisted).

**2. Per-topic quiz accuracy breakdown**
In the Dashboard's DC track section, show per-module quiz accuracy (avg score across lessons in that module), not just the overall average. This is a UI-only change to `DashboardPanel.tsx`.

**3. AI assistant panel (paid add-on)**
Add a collapsible chat panel (`components/ai/AIAssistantPanel.tsx`) that sends the current circuit state (components + wires + sim result) + active lesson progress to Claude Haiku via a proxied API call. The panel is hidden unless an API key is configured in Settings. Wire a basic Settings panel (`components/settings/SettingsPanel.tsx`) to store the key.

### Stack
React 18 + TypeScript + Tailwind CSS + Zustand (3 stores: `circuitStore`, `lessonStore`, `uiStore`) + Vitest + Testing Library. Electron + electron-vite for desktop; parallel `dev:web` browser target.

### Critical workflow rules — read carefully

**File writes must go through Python, not Edit/Write tools directly.**
The Edit and Write tools truncate large files when synced to the mount. Always write files like this:

```bash
python3 - <<'PYEOF'
content = r"""..."""
with open("/sessions/.../mnt/electronics-simulator/src/...", "w") as f:
    f.write(content)
PYEOF
```

The bash mount path for the project is:
`/sessions/eager-upbeat-clarke/mnt/electronics-simulator/`

**Test environment (`/tmp/volt`) must be synced manually** before running `npx tsc` or `npx vitest run`. Copy changed files with `shutil.copy2` in Python, then run from `/tmp/volt`. The `/tmp/volt` directory survives within a session but is wiped on desktop shutdown — recreate it with a tar copy + `npm install --prefer-offline` if missing.

**Cannot push to GitHub from the sandbox.** The user runs `git push` from PowerShell on their machine. Just commit; tell the user to push.

**Always verify file integrity** after writing: check `wc -l` and `tail` to confirm the file wasn't truncated mid-content.

### Test baseline
68 tests across 8 test files — all passing as of the last commit. Run `npx vitest run` from `/tmp/volt` to verify before committing.

### Key file map
```
src/renderer/src/
  sim/           solver.ts, netlist.ts, elements.ts
  lessons/       types.ts, validation.ts, dcLessons.ts, index.ts, lessons.test.ts
  stores/        circuitStore.ts, lessonStore.ts, uiStore.ts
  hooks/         useSimulation.ts
  lib/           circuitFiles.ts
  components/
    sandbox/     SandboxPanel.tsx, CircuitCanvas.tsx, Palette.tsx, Inspector.tsx
    lessons/     LessonsPanel.tsx
    dashboard/   DashboardPanel.tsx
    onboarding/  OnboardingQuiz.tsx
    layout/      Sidebar.tsx, TopBar.tsx, MainArea.tsx
```

Please read DEV_LOG.md and PROJECT_PLAN.md now, then confirm your understanding of where we are and propose a task breakdown for the next item (spaced-repetition review queue) before writing any code.
