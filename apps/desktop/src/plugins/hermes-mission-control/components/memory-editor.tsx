import { useState, useEffect, useCallback } from 'react'

import { host, Codicon, EmptyState, Loader, Button } from '@hermes/plugin-sdk'

import {
  getMemoryStatus,
  resetMemory,
  getMemoryProviderConfig,
  saveMemoryProviderConfig,
} from '../services/hermes-api'

import type {
  MemoryStatusResponse,
  MemoryProviderConfig,
  MemoryProviderField,
} from '../services/hermes-api'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatSize(chars: number): string {
  if (chars < 1000) return `${chars} chars`
  return `${(chars / 1000).toFixed(1)}k chars`
}

/* ------------------------------------------------------------------ */
/*  ProviderCard                                                       */
/* ------------------------------------------------------------------ */

function ProviderCard({
  provider,
  isActive,
  onSaved,
}: {
  provider: { name: string; description: string; configured: boolean }
  isActive: boolean
  onSaved: () => void
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [config, setConfig] = useState<MemoryProviderConfig | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [configError, setConfigError] = useState('')

  async function handleExpand(): Promise<void> {
    if (expanded) {
      setExpanded(false)
      return
    }
    setExpanded(true)
    if (config) return
    setLoadingConfig(true)
    setConfigError('')
    try {
      const cfg = await getMemoryProviderConfig(provider.name)
      setConfig(cfg)
      const vals: Record<string, string> = {}
      for (const f of cfg.fields) {
        vals[f.key] = f.value || ''
      }
      setFieldValues(vals)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setConfigError(msg)
    } finally {
      setLoadingConfig(false)
    }
  }

  async function handleSave(): Promise<void> {
    setSaving(true)
    setConfigError('')
    try {
      await saveMemoryProviderConfig(provider.name, fieldValues)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onSaved()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setConfigError(msg)
    } finally {
      setSaving(false)
    }
  }

  function renderField(field: MemoryProviderField): React.JSX.Element {
    const inputType = field.kind === 'secret' ? 'password' : 'text'
    return (
      <div key={field.key} className="memory-provider-field">
        <label className="memory-provider-field-label">
          {field.label || field.key}
          {field.is_set && (
            <span style={{ color: 'var(--success)', fontSize: 10, marginLeft: 6 }}>
              Set
            </span>
          )}
        </label>
        {field.description && (
          <span className="memory-provider-desc" style={{ fontSize: 11, marginBottom: 4 }}>
            {field.description}
          </span>
        )}
        {field.kind === 'select' && field.options.length > 0 ? (
          <select
            className="input"
            value={fieldValues[field.key] || ''}
            onChange={(e) =>
              setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))
            }
            style={{ fontSize: 12 }}
          >
            <option value="">Select...</option>
            {field.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="input"
            type={inputType}
            value={fieldValues[field.key] || ''}
            onChange={(e) =>
              setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))
            }
            placeholder={field.placeholder || `Enter ${field.label || field.key}`}
            style={{ fontSize: 12 }}
          />
        )}
      </div>
    )
  }

  return (
    <div
      className={`memory-provider-card ${isActive ? 'memory-provider-active' : ''}`}
    >
      <div className="memory-provider-header">
        <div className="memory-provider-name">
          {provider.name}
          {isActive && (
            <span className="memory-provider-badge">
              <Codicon name="check" size="0.65rem" /> Active
            </span>
          )}
          {provider.configured && !isActive && (
            <span className="memory-provider-badge" style={{ opacity: 0.6 }}>
              Configured
            </span>
          )}
        </div>
        <button
          className="btn-ghost"
          style={{ padding: 2 }}
          onClick={handleExpand}
          title={expanded ? 'Collapse' : 'Configure'}
        >
          <Codicon name={expanded ? 'chevron-up' : 'chevron-down'} size="0.85rem" />
        </button>
      </div>
      <div className="memory-provider-desc">{provider.description}</div>

      {expanded && (
        <div className="memory-provider-fields" style={{ marginTop: 8 }}>
          {loadingConfig && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
              <Loader />
            </div>
          )}

          {configError && <div className="memory-error">{configError}</div>}

          {config && config.fields.length > 0 && (
            <>
              {config.fields.map(renderField)}
              <div className="memory-provider-actions" style={{ marginTop: 8 }}>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
                </Button>
                {config.docs_url && (
                  <button
                    className="btn-ghost"
                    style={{ padding: 2, opacity: 0.6, marginLeft: 8 }}
                    onClick={() =>
                      host.request('shell.openExternal', { url: config.docs_url })
                    }
                    title="Open docs"
                  >
                    <Codicon name="link-external" size="0.75rem" />
                  </button>
                )}
              </div>
            </>
          )}

          {config && config.fields.length === 0 && (
            <div className="memory-empty" style={{ padding: 8 }}>
              <p>No configuration fields for this provider.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  MemoryEditor                                                       */
/* ------------------------------------------------------------------ */

export function MemoryEditor({ profile }: { profile?: string }): React.JSX.Element {
  const [status, setStatus] = useState<MemoryStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unavailable, setUnavailable] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const s = await getMemoryStatus()
      setStatus(s)
      setUnavailable(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/not implemented|not found/i.test(msg)) {
        setUnavailable(true)
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    loadData()
  }, [loadData])

  async function handleReset(): Promise<void> {
    setResetting(true)
    setError('')
    try {
      await resetMemory('all')
      setConfirmReset(false)
      await loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setResetting(false)
    }
  }

  /* ---- Unavailable state ---- */
  if (unavailable) {
    return (
      <div className="settings-container">
        <EmptyState
          title="Memory unavailable"
          description="The memory backend is not connected. Please ensure the gateway is running."
          className="memory-unavailable"
        />
      </div>
    )
  }

  /* ---- Loading state ---- */
  if (loading || !status) {
    return (
      <div className="settings-container">
        <h1 className="settings-header">Memory</h1>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Loader />
        </div>
      </div>
    )
  }

  return (
    <div className="settings-container">
      {/* Header */}
      <div className="memory-header">
        <div>
          <h1 className="settings-header" style={{ marginBottom: 4 }}>
            Memory
          </h1>
          <p className="memory-subtitle">Memory status and provider configuration</p>
        </div>
        <Button size="sm" onClick={loadData}>
          <Codicon name="refresh" size="0.8rem" />
        </Button>
      </div>

      {/* Status bar */}
      <div className="memory-stats">
        <div className="memory-stat">
          <span className="memory-stat-value">{status.active || 'none'}</span>
          <span className="memory-stat-label">Active Provider</span>
        </div>
        <div className="memory-stat">
          <span className="memory-stat-value">
            {formatSize(status.builtin_files.memory)}
          </span>
          <span className="memory-stat-label">memory.md</span>
        </div>
        <div className="memory-stat">
          <span className="memory-stat-value">
            {formatSize(status.builtin_files.user)}
          </span>
          <span className="memory-stat-label">user.md</span>
        </div>
      </div>

      {error && <div className="memory-error">{error}</div>}

      {/* Providers */}
      <div className="memory-providers">
        <div className="memory-providers-hint">
          Configure memory providers to extend agent recall.
        </div>

        {status.providers.length === 0 ? (
          <div className="memory-empty">
            <p>No memory providers found.</p>
          </div>
        ) : (
          <div className="memory-providers-grid">
            {status.providers.map((p) => (
              <ProviderCard
                key={p.name}
                provider={p}
                isActive={p.name === status.active}
                onSaved={loadData}
              />
            ))}
          </div>
        )}
      </div>

      {/* Reset section */}
      <div className="memory-providers" style={{ marginTop: 16 }}>
        <div className="memory-providers-hint">
          Reset all built-in memory files (memory.md and user.md). This cannot be undone.
        </div>
        {confirmReset ? (
          <div className="memory-entry-confirm" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>Are you sure you want to reset all memory?</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setConfirmReset(false)}
              disabled={resetting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleReset}
              disabled={resetting}
            >
              {resetting ? 'Resetting...' : 'Confirm Reset'}
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setConfirmReset(true)}
          >
            <Codicon name="trash" size="0.8rem" />
            Reset Memory
          </Button>
        )}
      </div>
    </div>
  )
}
