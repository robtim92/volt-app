# Volt — Project Scope & Development Plan (v2.0)

**Date:** June 12, 2026
**Supersedes:** `volt_project_plan_v1.2.docx` (May 2026) — all decisions in that document's Key Decisions Log remain in force unless noted.
**Repo:** https://github.com/robtim92/volt-app

---

## 1. Current State Assessment

### What exists (Phase 0 — App Shell: ~complete)
- **Scaffold:** Electron + electron-vite + React 18 + TypeScript + Tailwind, with a parallel `dev:web` browser target (`vite.web.config.ts`). Dual web/desktop builds work from one codebase as planned.
- **App shell:** Sidebar (3 tracks: DC / AC / Digital), TopBar with breadcrumb, MainArea with placeholder panels (Lessons, Sandbox, Dashboard, Settings), dark mode.
- **State:** Three Zustand stores matching the planned architecture:
  - `circuitStore` — component/wire/sim-result types defined, CRUD actions implemented, no solver yet
  - `lessonStore` — progress tracking + navigation, persisted
  - `uiStore` — theme/track/panel prefs, persisted
- **Testing/CI:** Vitest + Testing Library configured, 4 passing shell tests, GitHub Actions CI (typecheck → test → web build).
- **Branding:** navy/yellow/dark palette, Inter/JetBrains Mono.

### Gaps and issues found
1. **The GitHub repo is empty and the local folder is not a git repo.** Nothing has ever been committed or pushed. The CI workflow exists but has never run. → First action item.
2. No simulation engine, no canvas, no component library — Phase 1 has not started beyond type definitions.
3. No lesson content, quiz engine, or AI assistant (expected — Phases 2–3).
4. `electron-store` is a dependency but unused; persistence is currently localStorage-only via Zustand `persist`.
5. Playwright (planned for E2E) is not yet installed.

---

## 2. Scope (confirmed from v1.2 master plan)

**Product:** Free, open-source interactive electronics learning platform — Brilliant.org-style lessons + EveryCircuit-style live simulation + an optional **paid** AI tutor add-on. Target learner: curious adult hobbyist.

**Three content tracks:**
| Track | Coverage |
|---|---|
| DC Circuits | V/I/R, Ohm's Law & power, series/parallel, Kirchhoff, RC/RL, diodes/LEDs/BJTs |
| AC & Residential | Sine waves/RMS/phase, residential wiring, panels & protection, NEC safety, transformers (with safety disclaimer) |
| Digital Computing | Number systems, gates, Boolean algebra/K-maps, combinational & sequential logic, memory & CPU overview |

**Core platform features:** lesson card engine, embedded mini-sims, guided labs, quiz system with soft-gate nudges (<70% prompts review, never blocks), progress dashboard + lesson map, onboarding placement quiz, free sandbox with full component palette.

**Simulation engine:** MNA solver (Newton-Raphson for nonlinear) in a Web Worker for DC; phasor-domain AC; event-driven digital logic sim. Target: interactive framerates to ~200 components; WASM upgrade path.

**AI assistant (paid add-on):** context-aware tutor over Claude API (Haiku for latency/cost), receives full netlist + sim results + user progress; debug mode, tutor mode, lesson RAG linking, proactive badge alerts. Hidden offline.

**Out of scope for v1:** native mobile apps, cloud accounts (until Phase 5, optional), SPICE compatibility, community features, RF, microcontrollers.

---

## 3. Architecture

```
┌─ Presentation ── React components · Canvas circuit renderer · lesson cards · chat panel
├─ Application ─── Zustand stores · lesson engine · quiz engine · AI context assembler
├─ Simulation ──── Web Worker: MNA engine · digital logic engine · component models
└─ Data ────────── lesson JSON/MD · component definitions · progress store · circuit files
```

- **Desktop shell:** Electron (decision closed — Chromium canvas consistency, Node backend, WASM path; revisit Tauri in v2).
- **Rendering:** Canvas API for the circuit canvas; SVG for lesson diagrams.
- **Persistence:** localStorage (web) / electron-store (desktop) behind one storage interface; cloud sync deferred to Phase 5.
- **Solver validation:** unit-test against SPICE reference values (ngspice golden files in repo).

---

## 4. Development Roadmap

### Phase 0 — Foundation hardening ✅ (June 12, 2026)
- [x] `git init`, initial commit, push to `robtim92/volt-app`
- [x] Add README.md, LICENSE (MIT), CONTRIBUTING stub
- [x] Fix CI blockers: missing devDependencies (@electron-toolkit/tsconfig, @testing-library/user-event), missing package-lock.json, brittle shell test
- [ ] Branch protection on `main` (user action on GitHub)
- [ ] Storage abstraction (localStorage ↔ electron-store) — deferred; zustand persist + localStorage works in both targets for now

### Phase 1 — Simulator Core / MVP (~6–8 weeks) — 🚧 in progress

**Done (June 12, 2026):** MNA solver with Newton-Raphson diodes/LEDs (52 tests passing); component registry; union-find netlist builder; Web Worker simulation loop; interactive canvas sandbox (place / drag / rotate / wire / delete, voltage-colored wires, animated current flow, LED glow, switch toggling); inspector with live measurements; named save/load (versioned JSON in localStorage). Typecheck + web build clean.

**Also done (June 12, 2026, second pass):** canvas pan/zoom (wheel zoom about cursor, middle/Alt-drag pan, 0 resets), voltmeter/ammeter components with live readouts, PNG export, JSON file export/import in the toolbar.

**Remaining:** packaging verification (electron-builder Win/Mac — needs a real machine), Playwright E2E, hands-on usability pass.

1. **Solver first (weeks 1–3):** MNA engine in pure TS — resistors, V/I sources, ground; then Newton-Raphson for diodes/LEDs; Web Worker wrapper with a typed message protocol; SPICE-validated test suite. *This is the highest-risk item; build before UI.*
2. **Canvas (weeks 3–5):** grid canvas with pan/zoom; component palette (click-to-place, drag, rotate); terminal-to-terminal wiring with auto-routing; selection + property editor (value, label).
3. **Live simulation loop (weeks 5–6):** debounced re-solve on edits; node voltage color-coding; animated current flow on wires; voltmeter/ammeter components.
4. **Save/load (week 6):** named circuits, JSON circuit file format (versioned schema), export as PNG.
5. **Packaging (weeks 7–8):** electron-builder for Win/Mac; verify identical web behavior; Playwright E2E for core flows.

**MVP success criteria (unchanged from v1.2):** place components, draw wires, continuous real-time sim with animated current, save/reload, runs identically in browser and as desktop app, solver handles series/parallel/mixed + diodes.

### Phase 2 — Lesson Engine + DC Track (~8 weeks) — 🚧 started

**Done (June 12, 2026):** lesson schema (`lessons/types.ts`), card player with progress bar and first-answer quiz scoring, lesson list grouped by module with completion badges, 5 authored DC lessons (fundamentals, Ohm's law, series, parallel, diodes/LEDs) each with quizzes and sandbox circuit presets, content-integrity test suite (presets must solve in the simulator).

**Remaining in Phase 2:**
- Lesson card system (step sequencer, card types: concept / worked example / guided lab / challenge)
- Embedded mini-sim widgets inside cards; guided lab mode (constrained palette, step overlay, completion gate)
- All 6 DC modules authored (JSON/MD in repo; AI-assisted drafts, human-reviewed)
- Onboarding placement quiz; lesson progress tracking wired to `lessonStore`
- CMS/admin panel v1 (card editor, lab configurator) — start late in phase, finish in Phase 3 if needed

### Phase 3 — Quiz System + Dashboard + AI (~6 weeks)
- Quiz engine: multiple choice, numeric, **circuit completion** (see design below), T/F with explanation; instant feedback; soft-gate nudge (<70% score → review prompt, never hard-blocks)
- DC quizzes authored; spaced-repetition review scheduling
- Dashboard: per-track progress, lesson map (node graph), streak, quiz accuracy by topic
- Success-metrics instrumentation (quiz improvement over time; sandbox session length/complexity)
- **AI assistant (paid add-on):** Claude Haiku chat panel, circuit-state context injection, lesson RAG (build-time embeddings), debug/tutor modes, offline hiding, upgrade prompt for non-subscribers; API key proxy in Electron main process / lightweight serverless proxy for web

#### Circuit-Completion Quiz Design (Phase 3)

A `CircuitQuizCard` opens an embedded mini-sandbox inside the lesson card. The learner builds or modifies a circuit, then hits **Check Answer**. The solver runs and the result is validated against a set of declarative conditions authored alongside the lesson content. All conditions must pass for the card to be marked complete.

**Schema (`lessons/types.ts` additions):**

```typescript
export type CircuitConditionType =
  | 'circuit_solves'         // circuit must form a complete, solvable loop
  | 'element_current'        // I through a fixed element ID within [min, max]
  | 'component_type_current' // I through any component of a given type within [min, max]
  | 'component_present'      // circuit must contain ≥ count of a given ComponentType
  | 'component_absent'       // circuit must NOT contain a given ComponentType

export interface CircuitCondition {
  type: CircuitConditionType
  elementId?: string          // for 'element_current' — references a preset component ID
  componentType?: string      // for 'component_type_current', 'component_present', 'component_absent'
  min?: number                // lower bound (A for current checks)
  max?: number                // upper bound (A for current checks)
  count?: number              // minimum count (default 1) for 'component_present'
  label: string               // shown in failure feedback, e.g. "LED must be lit (> 10 mA)"
}

export interface CircuitQuizCard {
  type: 'circuit_quiz'
  question: string            // shown above the mini-sandbox
  instructions: string        // step-by-step task description
  starterCircuit?: CircuitPreset   // optional pre-wired starting circuit
  allowedComponents?: ComponentType[]  // if set, restricts the palette
  conditions: CircuitCondition[]   // ALL must pass
  hints?: string[]            // revealed one per failed attempt
  explanation: string         // shown after successful completion
}
```

**Why reference by element current rather than node voltage?**
Node names in the solver come from the union-find netlist builder and are not stable across user edits. Element IDs from the starter `CircuitPreset` are stable. For elements the learner adds (where no fixed ID exists), `component_type_current` matches any component of the given type — enough for most teaching scenarios ("an LED must be conducting").

**Validation function (`lessons/validation.ts`):**

```typescript
export function validateCircuitQuiz(
  components: CircuitComponent[],
  wires: Wire[],
  conditions: CircuitCondition[]
): { passed: boolean; failures: string[] }
```

Internally: `buildNetlist(components, wires)` → `solveDC(netlist)` → evaluate each condition. Returns the list of `label` strings for failed conditions so the UI can display specific, actionable feedback ("LED must be lit — check your current-limiting resistor").

**UI flow:**
1. Card loads → embedded mini-sandbox initialises with `starterCircuit` (if any); palette restricted to `allowedComponents` (if set).
2. Learner places components, draws wires.
3. **Check Answer** → runs `validateCircuitQuiz`; on pass: confetti + explanation; on fail: shows failure labels + reveals next hint if available.
4. No attempt limit — learner can try as many times as needed.
5. Card counted as complete on first passing attempt; quiz score counts only first attempt for the soft-gate calculation.

**Content-integrity test:** every `CircuitQuizCard`'s `starterCircuit` (if present) must `solveDC()` successfully, same as existing `ConceptCard` preset tests. The conditions themselves are validated for schema correctness at test time (all referenced `elementId`s must exist in the starter circuit).

**Example authored card:**
```typescript
{
  type: 'circuit_quiz',
  question: 'Wire the circuit so the LED lights up safely.',
  instructions: 'Connect the 9 V source, a current-limiting resistor (pick the right value!), and the LED. The LED needs between 10 mA and 30 mA to light.',
  starterCircuit: ledQuizStarter(), // 9V source + LED pre-placed, no wires
  allowedComponents: ['resistor', 'wire_node', 'ground'],
  conditions: [
    { type: 'circuit_solves', label: 'Circuit must be complete with no open loops' },
    { type: 'component_type_current', componentType: 'led', min: 0.010, max: 0.030,
      label: 'LED current must be between 10 mA and 30 mA' }
  ],
  hints: [
    'Ohm\'s Law: V = I × R. What voltage is across the resistor?',
    'With 9 V supply and ~2 V LED drop, the resistor sees ~7 V. At 20 mA, R = 7 / 0.02 = 350 Ω. Pick the nearest standard value.'
  ],
  explanation: 'A 390 Ω resistor gives ~17.9 mA — well within the safe range. Going lower risks burning out the LED; going much higher makes it too dim.'
}
```

### Phase 4 — AC Track (~8 weeks)
- Phasor-domain solver (complex impedance R/L/C); time-domain waveform reconstruction
- Oscilloscope/waveform view; AC component library (transformer, breaker, GFCI models)
- AC track content + guided labs with the mandated safety disclaimer; NEC reference module; AC quizzes

### Phase 5 — Digital Track + Polish (~8 weeks)
- Event-driven logic simulator with propagation delay; clocked sequential update
- Truth table panel, logic-level wire display, timing diagram view; digital component library
- Digital track content, labs, quizzes
- Performance pass (profile solver; WASM port if needed); optional cloud sync/accounts

**Total estimate: ~9 months to full v1**, with a usable public MVP at the end of Phase 1 (~2 months).

---

## 5. Working Practices

- **Definition of done per phase:** typecheck + tests green in CI, feature works in both web and Electron builds, solver changes validated against SPICE references.
- **Testing pyramid:** Vitest unit tests (solver gets the densest coverage), Testing Library for components, Playwright E2E for place-wire-simulate-save flows.
- **Content pipeline:** lesson JSON lives in-repo and is version-controlled; AI-drafted, author-validated.
- **Releases:** tagged GitHub releases with electron-builder artifacts (Win NSIS, Mac dmg) + deployed web build per phase milestone.

## 6. Risks

| Risk | Mitigation |
|---|---|
| MNA solver complexity (nonlinear convergence) | Build solver first, SPICE-validated; cap v1 component models to teaching set |
| Canvas UX is make-or-break | Prototype wiring interaction early in Phase 1; usability test with 2–3 target users |
| Content authoring volume (3 tracks) | AI-assisted drafting + CMS; DC track fully done before AC/Digital begin |
| AI add-on cost/abuse | Haiku model, compact context serialization, rate limits, paid gate |
| Scope creep | v1.2 "Out of Scope" list is binding; new ideas go to a v2 backlog |

---

## 7. Immediate Next Steps (this week)

1. Initialize git and push the existing code to GitHub — the remote repo is empty and at risk of divergence from local work.
2. Confirm CI passes on first push.
3. Begin Phase 1, step 1: MNA solver module (`src/renderer/src/sim/`) with resistor/source/ground support and its test suite.
