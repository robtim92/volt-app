/**
 * Volt — Circuit save/load
 *
 * Named circuits persist in localStorage (works in both browser and the
 * Electron renderer). The JSON format is versioned so saved circuits keep
 * loading as the schema evolves. Export/import uses the same format.
 */
import { ELEMENTS, type CircuitComponent, type Wire } from '../sim/elements'

const STORAGE_KEY = 'volt-saved-circuits'
export const CIRCUIT_FILE_VERSION = 1

export interface CircuitFile {
  version: number
  name: string
  savedAt: string // ISO timestamp
  components: CircuitComponent[]
  wires: Wire[]
}

export interface CircuitSummary {
  name: string
  savedAt: string
  componentCount: number
}

type Catalog = Record<string, CircuitFile>

function readCatalog(): Catalog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Catalog) : {}
  } catch {
    return {}
  }
}

function writeCatalog(catalog: Catalog): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog))
}

// ── Validation ───────────────────────────────────────────────────────────────

/** Validate an untrusted parsed object; returns an error string or null. */
export function validateCircuitFile(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return 'Not a circuit file'
  const f = data as Partial<CircuitFile>
  if (typeof f.version !== 'number' || f.version > CIRCUIT_FILE_VERSION)
    return 'Unsupported circuit file version'
  if (!Array.isArray(f.components) || !Array.isArray(f.wires))
    return 'Circuit file is missing components or wires'

  const ids = new Set<string>()
  for (const c of f.components) {
    if (typeof c?.id !== 'string' || !(c?.type in ELEMENTS))
      return 'Circuit file contains an unknown component'
    if (typeof c.x !== 'number' || typeof c.y !== 'number')
      return 'Circuit file contains an invalid component position'
    ids.add(c.id)
  }
  for (const w of f.wires) {
    if (!ids.has(w?.fromComponentId) || !ids.has(w?.toComponentId))
      return 'Circuit file contains a wire to a missing component'
    if (typeof w.fromTerminal !== 'number' || typeof w.toTerminal !== 'number')
      return 'Circuit file contains an invalid wire'
  }
  return null
}

// ── API ──────────────────────────────────────────────────────────────────────

export function listCircuits(): CircuitSummary[] {
  return Object.values(readCatalog())
    .map((f) => ({ name: f.name, savedAt: f.savedAt, componentCount: f.components.length }))
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export function saveCircuit(
  name: string,
  components: CircuitComponent[],
  wires: Wire[]
): void {
  const catalog = readCatalog()
  catalog[name] = {
    version: CIRCUIT_FILE_VERSION,
    name,
    savedAt: new Date().toISOString(),
    components,
    wires
  }
  writeCatalog(catalog)
}

export function loadCircuit(
  name: string
): { components: CircuitComponent[]; wires: Wire[] } | null {
  const file = readCatalog()[name]
  if (!file || validateCircuitFile(file) !== null) return null
  return { components: file.components, wires: file.wires }
}

export function deleteCircuit(name: string): void {
  const catalog = readCatalog()
  delete catalog[name]
  writeCatalog(catalog)
}

export function exportCircuitJSON(
  name: string,
  components: CircuitComponent[],
  wires: Wire[]
): string {
  const file: CircuitFile = {
    version: CIRCUIT_FILE_VERSION,
    name,
    savedAt: new Date().toISOString(),
    components,
    wires
  }
  return JSON.stringify(file, null, 2)
}

export function importCircuitJSON(
  json: string
): { components: CircuitComponent[]; wires: Wire[] } | { error: string } {
  try {
    const data = JSON.parse(json)
    const error = validateCircuitFile(data)
    if (error) return { error }
    const f = data as CircuitFile
    return { components: f.components, wires: f.wires }
  } catch {
    return { error: 'Invalid JSON' }
  }
}
