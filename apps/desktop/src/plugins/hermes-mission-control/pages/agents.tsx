import { useState } from 'react'

import {
  Button,
  Codicon,
  EmptyState,
  Loader,
  queryClient,
  useMutation,
  useQuery,
} from '@hermes/plugin-sdk'

import {
  createProfile,
  deleteProfile,
  getProfiles,
  navigateToChat,
  setActiveProfile,
} from '../services/hermes-api'
import type { ProfileInfo } from '../services/hermes-api'

import { Wallpaper } from '../wallpaper'
import { CliChat } from '../components/cli-chat'

/* ------------------------------------------------------------------ */
/*  AI CLIs                                                            */
/* ------------------------------------------------------------------ */

const AI_CLIS = [
  { icon: 'sparkle', label: 'Codex', cmd: 'codex', desc: 'OpenAI coding agent' },
  { icon: 'code', label: 'Claude Code', cmd: 'claude', desc: 'Anthropic coding agent' },
] as const

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function providerLabel(provider: string | null): string {
  if (!provider || provider === 'auto') return 'Auto'
  if (provider === 'custom') return 'Local'
  return provider.charAt(0).toUpperCase() + provider.slice(1)
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function AgentAvatar({ name, isActive }: { name: string; isActive: boolean }) {
  if (name === 'default') {
    return (
      <div
        className={`agents-card-avatar agents-card-avatar-icon${isActive ? ' active' : ''}`}
      >
        <Codicon name="account" />
      </div>
    )
  }
  return (
    <div className={`agents-card-avatar${isActive ? ' active' : ''}`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function AgentsPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [cloneConfig, setCloneConfig] = useState(true)
  const [createError, setCreateError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [activeCli, setActiveCli] = useState<(typeof AI_CLIS)[number] | null>(null)

  if (activeCli) {
    return (
      <div className="hmc-page">
        <Wallpaper />
        <CliChat
          cli={activeCli.cmd}
          label={activeCli.label}
          onBack={() => setActiveCli(null)}
        />
      </div>
    )
  }

  /* ── data ── */

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['profile.list'],
    queryFn: () => getProfiles(),
    refetchInterval: 30_000,
    retry: false,
  })

  const profiles: ProfileInfo[] = data?.profiles ?? []

  const setActiveMutation = useMutation({
    mutationFn: (name: string) => setActiveProfile(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile.list'] }),
  })

  const createMutation = useMutation({
    mutationFn: (params: { name: string; cloneConfig: boolean }) =>
      createProfile({ name: params.name, clone_from_default: params.cloneConfig }),
    onSuccess: () => {
      setShowCreate(false)
      setNewName('')
      setCreateError('')
      queryClient.invalidateQueries({ queryKey: ['profile.list'] })
    },
    onError: (err: Error) => {
      setCreateError(err.message ?? 'Failed to create profile')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => deleteProfile(name),
    onSuccess: () => {
      setConfirmDelete(null)
      queryClient.invalidateQueries({ queryKey: ['profile.list'] })
    },
  })

  /* ── handlers ── */

  function handleCreate() {
    const name = newName.trim().toLowerCase()
    if (!name) return
    setCreateError('')
    createMutation.mutate({ name, cloneConfig })
  }

  function handleSelect(name: string) {
    setActiveMutation.mutate(name)
  }

  function handleDelete(name: string) {
    deleteMutation.mutate(name)
  }

  function handleChat(name: string) {
    // Activate profile then navigate to chat
    setActiveMutation.mutate(name, {
      onSuccess: () => navigateToChat(),
    })
  }

  /* ── render ── */

  if (isLoading) {
    return (
      <div className="hmc-page">
        <Wallpaper />
        <div className="agents-loading">
          <Loader />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="hmc-page">
        <Wallpaper />
        <EmptyState
          title="Profiles unavailable"
          description="Profiles will be available once the gateway backend is connected."
        />
      </div>
    )
  }

  return (
    <div className="hmc-page">
      <Wallpaper />

      {/* Header */}
      <div className="agents-header">
        <div>
          <h2 className="agents-title">Agents</h2>
          <p className="agents-subtitle">
            Manage profiles, personas, and configurations
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreate(true)}
        >
          <Codicon name="add" />
          New Agent
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="agents-create">
          <input
            className="agents-create-input"
            placeholder="profile-name (lowercase, alphanumeric)"
            value={newName}
            onChange={(e) => {
              const v = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')
              setNewName(v)
              setCreateError('')
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <label className="agents-create-clone">
            <input
              type="checkbox"
              checked={cloneConfig}
              onChange={(e) => setCloneConfig(e.target.checked)}
            />
            <span>Clone current config</span>
          </label>
          {createError && (
            <div className="agents-create-error">{createError}</div>
          )}
          <div className="agents-create-actions">
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={createMutation.isPending || !newName.trim()}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowCreate(false)
                setCreateError('')
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* AI CLIs */}
      <section className="mission-panel agents-clis">
        <div className="mission-panel-title">
          <div>
            <span>CLI & Terminal</span>
            <h2>AI CLIs</h2>
          </div>
        </div>
        <div className="mission-bucket-grid">
          {AI_CLIS.map((tool) => (
            <button key={tool.cmd} type="button" onClick={() => setActiveCli(tool)}>
              <strong><Codicon name={tool.icon} size="1rem" /> {tool.label}</strong>
              <span>{tool.desc}</span>
              <code className="mt-1 block text-[0.65rem] opacity-60">{tool.cmd}</code>
            </button>
          ))}
        </div>
      </section>

      {/* Card grid */}
      <div className="agents-grid">
        {profiles.map((p) => (
          <div
            key={p.name}
            className={`agents-card${p.is_default ? ' default' : ''}`}
            onClick={() => handleSelect(p.name)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSelect(p.name)
            }}
          >
            <div className="agents-card-header">
              <AgentAvatar name={p.name} isActive={p.is_default} />
              <div className="agents-card-info">
                <div className="agents-card-name">{p.name}</div>
                <div className="agents-card-provider">
                  {providerLabel(p.provider)}
                </div>
              </div>
            </div>

            <div className="agents-card-model">
              {p.model ? p.model.split('/').pop() : 'No model set'}
            </div>

            <div className="agents-card-stats">
              <span>
                {p.skill_count} {p.skill_count === 1 ? 'skill' : 'skills'}
              </span>
            </div>

            <div className="agents-card-footer">
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleChat(p.name)
                }}
              >
                <Codicon name="comment-discussion" />
                Chat
              </Button>
              {!p.is_default &&
                (confirmDelete === p.name ? (
                  <div
                    className="agents-card-confirm-delete"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>Delete?</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(p.name)
                      }}
                    >
                      Yes
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmDelete(null)
                      }}
                    >
                      No
                    </Button>
                  </div>
                ) : (
                  <button
                    className="agents-card-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDelete(p.name)
                    }}
                    title="Delete profile"
                  >
                    <Codicon name="trash" />
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
