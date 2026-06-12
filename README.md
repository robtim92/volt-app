# ⚡ Volt — Electronics Learning Platform

An interactive electronics learning platform that takes a complete beginner to confident practitioner across three tracks: **DC Circuits**, **AC & Residential Wiring**, and **Digital Computing**.

Volt combines Brilliant.org-style step-by-step interactive lessons with EveryCircuit-style live circuit simulation, plus an optional AI-powered tutor that watches what you build and helps you understand it in real time.

**Free and open source.** The simulator, lessons, quizzes, and dashboard have no paywall. The AI assistant is an optional paid add-on.

## Status

🚧 **Phase 1 — Simulator Core (in progress).** See [PROJECT_PLAN.md](PROJECT_PLAN.md) for the full scope and roadmap, and `volt_project_plan_v1.2.docx` for the original master plan.

## Tech Stack

React 18 + TypeScript + Tailwind CSS, wrapped in Electron for desktop (Windows/Mac) with an identical browser build. State via Zustand. Circuit simulation via a custom MNA (Modified Nodal Analysis) solver, designed to run in a Web Worker. Testing with Vitest.

## Development

```bash
npm install

npm run dev        # Electron app (hot reload)
npm run dev:web    # Browser only
npm test           # Unit tests
npm run typecheck  # TS type checking
npm run package    # Build distributable desktop app
```

## Project Structure

```
src/
  main/        Electron main process
  preload/     Electron preload bridge
  renderer/    React app (shared by web and desktop)
    src/
      components/   UI components
      stores/       Zustand stores (circuit, lesson, ui)
      sim/          Circuit simulation engine (MNA solver)
```

## Safety Note

The AC & Residential track teaches concepts and code references only. Real residential wiring must be performed by or under the supervision of a licensed electrician.

## License

[MIT](LICENSE)
