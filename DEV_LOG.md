# Volt — Development Log

---

## Phase 3 (partial) — Circuit-Completion Quiz System
**Commit:** `4bb91ba` · **Date:** June 13, 2026

### Shipped
- **`lessons/types.ts`** — Added `CircuitConditionType`, `CircuitCondition`, `CircuitQuizCard` types; updated `LessonCard` union to include `circuit_quiz`
- **`lessons/validation.ts`** *(new)* — `validateCircuitQuiz()`: runs the MNA solver against declarative conditions (`circuit_solves`, `component_type_current`, `voltmeter_reads`, `component_present`, `component_absent`); returns pass/fail + failure labels for UI feedback
- **`stores/uiStore.ts`** — `ActiveCircuitQuiz` state + `startCircuitQuiz` / `setCircuitQuizResult` / `clearCircuitQuiz` actions; switching to sandbox is wired into `startCircuitQuiz`
- **`stores/lessonStore.ts`** — `circuitQuizResults` (persisted to localStorage) + `recordCircuitQuizResult` action
- **`SandboxPanel.tsx`** — `QuizModeBanner`: shows question + instructions, Check Answer button, pass/fail result, progressive hints (one revealed per failed attempt), Return to lesson button; loads starter circuit on mount
- **`Palette.tsx`** — `allowedTypes` prop restricts the component palette to what the quiz author specifies
- **`LessonsPanel.tsx`** — `CircuitQuizCardView` card renderer; `circuit_quiz` gates "Next" on attempt (not pass); lesson quiz score counts only `type:'quiz'` cards
- **`dcLessons.ts`** — Two circuit quizzes authored:
  - *dc-semi-1*: LED wiring challenge — 5V source + LED pre-placed, learner adds resistor, must hit 10–30 mA
  - *dc-topo-1*: Voltage divider challenge — 12V source + voltmeter pre-placed, learner builds divider for ~4V output
- **`DashboardPanel.tsx`** — "Needs Review" section surfaces lessons with quiz score < 70% at the top of the dashboard

### Test status
68 tests passing · typecheck clean

---

## Phase 2 — Lesson Engine + DC Track
**Commits:** `3846a90`, `b412ef2` · **Date:** June 13, 2026

### Shipped
- **Lesson card player** (`LessonsPanel.tsx`) — concept cards advance freely; quiz cards lock on first answer (that answer counts toward score); "Open in sandbox" button deep-links a circuit preset into the live canvas
- **Soft-gate completion screen** — score < 70% shows "Review lesson" nudge; never hard-blocks
- **8 DC lessons across 6 modules** (`dcLessons.ts`):
  - *Fundamentals*: dc-fund-1 — Voltage, Current & Resistance
  - *Ohm's Law & Power*: dc-ohm-1 — Ohm's Law · dc-ohm-2 — Power & Energy
  - *Circuit Topology*: dc-topo-1 — Series Circuits · dc-topo-2 — Parallel Circuits
  - *Kirchhoff's Laws*: dc-kirckhoff-1
  - *Reactive Components*: dc-rc-1 — RC & RL Time Constants
  - *Semiconductor Basics*: dc-semi-1 — Diodes & LEDs
- **Content-integrity test suite** (`lessons.test.ts`) — every circuit preset verified solvable by the MNA engine
- **Dashboard panel** (`DashboardPanel.tsx`) — DC track progress bar, per-module lesson list, avg quiz score, "Continue" shortcut
- **Onboarding placement quiz** (`OnboardingQuiz.tsx`) — 5 diagnostic questions → recommended starting lesson; dismissible overlay

### Test status
68 tests passing · typecheck clean

---

## Phase 1 — Simulator Core
**Commits:** multiple · **Date:** June 12, 2026

### Shipped
- **MNA solver** (`sim/solver.ts`) — pure TypeScript Modified Nodal Analysis; resistors, voltage/current sources, ground; Newton-Raphson for diodes/LEDs (Shockley model, SPICE-style junction voltage limiting); 52 solver tests validated against reference values
- **Netlist builder** (`sim/netlist.ts`) — union-find over terminals; capacitor → open circuit, inductor → 1 mΩ short in DC steady state
- **Component registry** (`sim/elements.ts`) — 13 component types with terminal geometry, palette metadata, default values
- **Web Worker simulation loop** (`hooks/useSimulation.ts`) — debounced re-solve on circuit edits; typed message protocol
- **Interactive canvas** (`components/sandbox/CircuitCanvas.tsx`) — grid snap, click-to-place, drag, rotate (R key), terminal-to-terminal wiring, selection + delete; voltage-colored wires; animated current flow arrows; LED glow; switch toggling
- **Palette + Inspector** — component picker, live measurements panel
- **Pan/zoom** — wheel zoom about cursor, middle/Alt-drag pan, 0 to reset
- **Voltmeter/ammeter** — live readouts on canvas and in inspector
- **Save/load** — named circuits in localStorage; versioned JSON schema
- **PNG export** — canvas snapshot
- **JSON export/import** — `.volt.json` circuit file format

### Test status
68 tests passing · typecheck clean

---

## Phase 0 — Foundation
**Date:** June 12, 2026

- `git init`, initial commit, push to `robtim92/volt-app`
- README, LICENSE (MIT), CONTRIBUTING stub
- CI fixed: missing devDependencies, package-lock.json, brittle shell test
- Stack: Electron + electron-vite + React 18 + TypeScript + Tailwind CSS + Zustand + Vitest + Testing Library

---

## Up Next

### Phase 3 — Remaining items
- **Spaced-repetition review queue** — SM-2-style scheduling; resurface cards based on time since last attempt and score
- **Per-topic quiz accuracy** — dashboard breakdown by module (not just overall avg)
- **AI assistant (paid add-on)** — Claude Haiku chat panel; receives full netlist + sim results + user progress; debug mode, tutor mode, lesson RAG linking; offline-hidden, upgrade prompt for non-subscribers; API key proxied through Electron main process / lightweight serverless proxy for web

### Phase 4 — AC Track
- Phasor-domain solver (complex impedance R/L/C)
- Oscilloscope / waveform view
- AC component library (transformer, breaker, GFCI models)
- AC track lessons + guided labs with safety disclaimer
- NEC reference module + AC quizzes

### Phase 5 — Digital Track + Polish
- Event-driven logic simulator with propagation delay; clocked sequential update
- Truth table panel, logic-level wire display, timing diagram view
- Digital component library + track lessons
- Performance pass (profile solver; WASM port if needed)
- Optional cloud sync / accounts
