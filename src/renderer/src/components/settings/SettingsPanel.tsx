/**
 * Volt — Settings panel
 *
 * Currently focused on the AI assistant add-on: enter / update / remove the
 * Claude API key that unlocks the in-app tutor. The key is stored locally
 * (localStorage) and used to call the Anthropic API directly from this app.
 */
import { useState } from 'react'
import { useSettingsStore, hasApiKey } from '@stores/settingsStore'
import { useGameStore } from '@stores/gameStore'

export default function SettingsPanel(): JSX.Element {
  const apiKey = useSettingsStore((s) => s.apiKey)
  const aiModel = useSettingsStore((s) => s.aiModel)
  const setApiKey = useSettingsStore((s) => s.setApiKey)
  const clearApiKey = useSettingsStore((s) => s.clearApiKey)

  const configured = hasApiKey({ apiKey })
  const unlockAll = useGameStore((s) => s.unlockAll)
  const setUnlockAll = useGameStore((s) => s.setUnlockAll)
  const [draft, setDraft] = useState('')
  const [reveal, setReveal] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  const save = (): void => {
    if (!draft.trim()) return
    setApiKey(draft)
    setDraft('')
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 2000)
  }

  const masked = configured
    ? `${apiKey.slice(0, 7)}…${apiKey.slice(-4)}`
    : ''

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Configure the AI assistant and other preferences.
        </p>

        {/* Campaign */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Campaign</h2>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={unlockAll}
              onChange={(e) => setUnlockAll(e.target.checked)}
              className="mt-1 h-4 w-4 accent-brand-yellow"
              aria-label="Unlock every mission"
            />
            <span>
              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">Unlock every mission</span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">
                Open all chapters and missions, ignoring stars and order. Handy for exploring or testing. Your stars and XP are kept.
              </span>
            </span>
          </label>
        </section>

        {/* AI assistant section */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">AI Assistant</h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-yellow/20 text-amber-700 dark:text-amber-300">
              Add-on
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Volt AI is a built-in tutor that can see your circuit and lesson progress and
            help you debug. Bring your own Anthropic API key to enable it.
          </p>

          {configured && (
            <div className="flex items-center justify-between gap-3 mb-4 px-4 py-3 rounded-lg border border-green-300 dark:border-green-500/40 bg-green-50 dark:bg-green-500/10">
              <span className="text-sm text-gray-700 dark:text-gray-200">
                Key configured <span className="font-mono text-xs text-gray-500 dark:text-gray-400">({masked})</span>
              </span>
              <button
                onClick={clearApiKey}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                Remove key
              </button>
            </div>
          )}

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            {configured ? 'Replace API key' : 'Anthropic API key'}
          </label>
          <div className="flex gap-2">
            <input
              type={reveal ? 'text' : 'password'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="sk-ant-…"
              autoComplete="off"
              spellCheck={false}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-white/15 bg-white dark:bg-brand-navy/40 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-brand-yellow"
            />
            <button
              onClick={() => setReveal((r) => !r)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-white/15 text-sm text-gray-600 dark:text-gray-300 hover:border-brand-yellow/60"
              aria-label={reveal ? 'Hide key' : 'Show key'}
            >
              {reveal ? '🙈' : '👁'}
            </button>
            <button
              onClick={save}
              disabled={!draft.trim()}
              className="px-4 py-2 rounded-lg bg-brand-yellow text-brand-dark text-sm font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {justSaved ? 'Saved ✓' : 'Save'}
            </button>
          </div>

          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            <span className="font-semibold">Security:</span> your key is stored only in this
            browser/app (localStorage) and sent directly to Anthropic from your device — Volt
            has no server and never sees it. Anyone with access to this device can read it, so
            don&apos;t use a shared machine. Get a key at{' '}
            <span className="font-mono">console.anthropic.com</span>. Usage is billed to your
            Anthropic account. Model: <span className="font-mono">{aiModel}</span>.
          </p>
        </section>

        {/* Placeholder for future settings */}
        <section className="opacity-60">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Preferences</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Unit system, formula notation, and theme options are coming in a later phase.
          </p>
        </section>
      </div>
    </div>
  )
}
