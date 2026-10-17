# Volt — Development Log

---

## Wire routing — bends, corners and curves
**Date:** October 17, 2026

### Shipped
- **Automatic routes** (`sim/wireRoute.ts`): every wire runs in horizontal and vertical sections, leaving
  each terminal the way it faces. The router tries several L, Z and U shapes and picks the shortest one
  that doesn't cut through a part or run over another terminal. Old saved circuits route automatically.
- **Hand routing**: tap or click a terminal, tap the board to drop corners, tap a terminal to finish
  (Cancel / undo-corner chip; Esc, Backspace and right-click work too). Dragging from a terminal and letting
  go on the board continues the same way.
- **Reshaping**: drag any section of a wire sideways; drag a corner of the selected wire; double-click
  (double-tap) a wire to add a bend, a corner to remove it; Straighten resets it. Moving a part keeps the
  hand-placed corners and re-bends only the sections touching it.
- **Square or Rounded corners** per wire, with a "use for every wire" board default.
- Wire length (and so resistance and voltage drop) follows the route. 3D jumpers follow it too.

### Test status
290 tests passing · typecheck clean · web build OK · routing checked in headless Chromium (desktop + phone).

### Next
Junctions (tap into the middle of a wire), then Phase H.

---

## Gamified 3D Lab — Step 5 (realistic wires and power sources)
**Date:** October 17, 2026

### Shipped
- **Wires are real copper** (`sim/wire.ts`): every wire is a resistor in the live sim, from its gauge
  (AWG 4–30, default 22) and length (drawn length, or set in metres). Annealed-copper resistivity;
  published Ω/km within 2%. Ampacity table drives wire heating; overloaded wires glow and melt open.
  Inspector: gauge, length, resistance, voltage drop, heat, Replace wire. Schematic and 3D draw thicker
  wire for heavier gauges.
- **Batteries** (`sim/battery.ts`): AA / 9 V alkaline, Li-ion 18650, LiFePO4, lead-acid. Open-circuit
  voltage follows state of charge, internal resistance makes voltage sag under load, charge drains in
  real (sim) time, shorts overheat the pack. Inspector shows charge, time left, Recharge. Per-chemistry
  3D models.
- **Bench supply**: voltage setpoint + current limit; switches between CV and CC within the time step.
  3D model with live V/A display and CV/CC light.
- **Look inside the wire**: animated copper lattice with electrons jiggling and drifting (speed-up
  shown), stats for current density, drift speed, drop and heat, and a side-by-side gauge comparison.
- **Examples**: new "Power & wiring" category: battery under load, long wires and voltage drop, bench
  supply current limit. Breaker example now uses 14 AWG wire (22 AWG would melt at 9 A).
- Test harnesses for examples, levels and lessons now include wire heating.

### Test status
281 tests passing · typecheck clean · web build OK · new examples checked in headless Chromium (desktop + phone).

### Next
Phase H — home power systems.

---

## Gamified 3D Lab — Steps 0–4 (live sim, heat/damage, 3D bench, campaign)
**Date:** October 17, 2026

Direction change agreed with Tim: make Volt a visual, gamified lab. 3D is a *companion* view of the
schematic (not the only editor); browser-first with Electron optional; audience stays the curious adult
hobbyist; chem-sim stays a separate project.

### Shipped
- **Step 0** — committed the abandoned Phase 4E AC lessons; `npm run dev`/`build` now target the browser
  (Electron → `dev:desktop`/`build:desktop`); added three.js + React Three Fiber 8 + drei 9 (React 18).
- **Step 1 — live time-domain simulation** (`sim/transient.ts`): transient MNA with trapezoidal
  companion models for C/L (backward-Euler restart after topology changes), per-step Newton-Raphson
  diodes, sine sources, inductive-kickback arcs, state carried across edits. `useLiveSimulation` runs it on
  rAF with play/pause, time scale (1/1000× … 4×) and reset; it owns `simResult` for non-AC circuits
  (AC circuits keep the phasor result). Ground is auto-referenced at the source's (−) terminal.
- **Heat & damage** (`sim/thermal.ts`): first-order thermal model per part — resistors burn (¼ W
  default), LEDs pop (30 mA), capacitors blow (50 V), ammeter fuses blow (10 A), breakers/GFCIs trip
  open. Teaching toast explains each failure; Inspector shows temperature bar, rating, "Replace part".
- **Live scope**: strip-chart of node voltages vs. simulated time (cap charging, blinking, rectifying).
- **Step 2 — 3D workbench** (`components/bench/`): lazy-loaded R3F scene mirroring the schematic —
  colour-coded resistors, electrolytic/ceramic caps, LEDs that light the bench, battery, switches,
  breakers, meters with live readouts, voltage-coloured jumpers with flowing charge, sparks and smoke on
  failure, bloom. Schematic / Split / 3D toggle (persisted).
- **Step 3 — campaign layer** (`game/`, `stores/gameStore.ts`): levels with live goals + hold timer,
  ★2/★3 criteria (clean run, part count, current band, supply current), XP + 5 ranks, 5 badges, parts
  collection, map with unlocks, mission HUD with progressive hints, completion card with debrief.
- **Step 4 — Chapter 1 "Light It Up"**: Close the Loop · Let the Smoke Out · Chain Reaction (series) ·
  Branch Out (parallel) · Afterglow (RC). Every level ships a reference solution the tests play through
  the live sim (must earn 3 stars) and a check that the starter isn't already solved.
- Misc: values read "10 mA"/"4.7 kΩ"; schematic auto-fits loaded circuits (F to fit); rank/XP chip in
  the top bar; dev-only `window.__volt` handle for E2E.

### Test status
219 tests passing · typecheck clean · web build OK (3D code in its own ~250 kB gz chunk) · all 5 levels
played end-to-end in headless Chromium.

### Next
Step 5: "zoom inside" views (electron drift, capacitor plates, inductor field), drag-to-place in 3D,
Chapter 2 (capacitors/RC timing, diodes) and AC chapters; then digital track as planned.

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
