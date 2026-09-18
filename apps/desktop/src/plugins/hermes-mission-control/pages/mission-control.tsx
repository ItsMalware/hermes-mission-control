import { useMemo, useState } from 'react'

import {
  cn,
  Codicon,
  host,
  Loader,
  Tabs,
  TabsList,
  TabsTrigger,
  useQuery,
  useValue,
} from '@hermes/plugin-sdk'

import { getCronJobs } from '../services/hermes-api'
import { Wallpaper } from '../wallpaper'

type ControlTab = 'system' | 'services' | 'sessions' | 'workspace'

const TERMINAL_TOOLS = [
  { icon: 'terminal-bash', label: 'OpenCode', cmd: 'opencode', desc: 'AI-powered code editor' },
  { icon: 'terminal', label: 'NTN CLI', cmd: 'ntn', desc: 'Netlify CLI tools' },
  { icon: 'rocket', label: 'Agy', cmd: 'agy', desc: 'Agent runner CLI' },
  { icon: 'code', label: 'Claude Code', cmd: 'claude', desc: 'Anthropic coding agent' },
  { icon: 'server', label: 'Hermes Agent', cmd: 'hermes-agent', desc: 'Hermes backend CLI' },
  { icon: 'beaker', label: 'Gemini CLI', cmd: 'gemini', desc: 'Google AI CLI' },
] as const

interface PlatformStatus {
  state: string
  updated_at: string
  error_code?: string
  error_message?: string
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        'inline-block size-2 rounded-full',
        ok ? 'bg-emerald-400' : 'bg-red-400'
      )}
    />
  )
}

function fmtTime(iso: string | null): string {
  if (!iso) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

function localTime(): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date())
}

export function MissionControlPage() {
  const [tab, setTab] = useState<ControlTab>('system')
  const gateway = useValue(host.state.gateway)
  const model = useValue(host.state.model)
  const profile = useValue(host.state.profile)

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['hermes', 'status'],
    queryFn: () => host.status(),
    refetchInterval: 15_000,
  })

  const { data: sessions } = useQuery({
    queryKey: ['hermes', 'sessions'],
    queryFn: () =>
      host.request<{
        sessions: Array<{
          id: string
          title: string
          model: string
          created_at: string
          message_count: number
        }>
      }>('session.list', {}),
    refetchInterval: 30_000,
  })

  const { data: cronJobs } = useQuery({
    queryKey: ['hermes', 'cronJobs'],
    queryFn: () => getCronJobs().catch(() => [] as Awaited<ReturnType<typeof getCronJobs>>),
    refetchInterval: 30_000,
  })

  const platforms = useMemo(() => {
    if (!status?.gateway_platforms) return []
    return Object.entries(
      status.gateway_platforms as Record<string, PlatformStatus>
    ).map(([key, val]) => ({
      key,
      label: key,
      running: val.state === 'running',
      detail: val.error_message ?? val.state,
    }))
  }, [status])

  const livePlatforms = platforms.filter(p => p.running).length

  return (
    <div className="hmc-page">
      <Wallpaper />

      <header className="mission-hero">
        <div>
          <h1 className="hmc-page-title">Hermes Mission Control</h1>
          <p className="text-sm text-(--ui-text-secondary)">
            Profile: <strong>{profile || 'default'}</strong> · Model:{' '}
            <strong>{model || 'auto'}</strong> · Gateway:{' '}
            <strong>{gateway}</strong>
          </p>
          <div className="mt-1 text-xs tabular-nums text-(--ui-text-tertiary)">
            {localTime()} Local
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="mission-command"
            type="button"
            onClick={() => host.navigate('/')}
          >
            <Codicon name="comment-discussion" size="0.8rem" />
            <span>Chat</span>
          </button>
          <button
            className="mission-command"
            type="button"
            onClick={() => void refetch()}
            disabled={isLoading}
          >
            <Codicon name="refresh" size="0.8rem" />
            <span>{isLoading ? 'Refreshing' : 'Refresh'}</span>
          </button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={v => setTab(v as ControlTab)}>
        <TabsList>
          <TabsTrigger value="system">
            <Codicon name="dashboard" size="0.75rem" />
            System
          </TabsTrigger>
          <TabsTrigger value="services">
            <Codicon name="server-environment" size="0.75rem" />
            Services
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Codicon name="comment" size="0.75rem" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="workspace">
            <Codicon name="layout" size="0.75rem" />
            Workspace
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'system' && (
        <div className="mission-control-room">
          {isLoading && !status ? (
            <Loader type="lemniscate-bloom" />
          ) : status ? (
            <>
              <section className="mission-panel">
                <div className="mission-panel-title">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-(--ui-text-tertiary)">
                      {livePlatforms}/{platforms.length} platforms active
                    </span>
                    <h2>System Status</h2>
                  </div>
                </div>
                <div className="mission-glance">
                  <div className="mission-glance-stats">
                    <div>
                      <span>Gateway</span>
                      <strong>
                        {status.gateway_running ? 'Running' : 'Stopped'}
                      </strong>
                    </div>
                    <div>
                      <span>Sessions</span>
                      <strong>{status.active_sessions}</strong>
                    </div>
                    <div>
                      <span>Version</span>
                      <strong>{status.version}</strong>
                    </div>
                    <div>
                      <span>Config</span>
                      <strong>v{status.config_version}</strong>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mission-panel">
                <div className="mission-panel-title">
                  <div>
                    <h2>Platforms</h2>
                  </div>
                </div>
                <div className="mission-list">
                  {platforms.map(p => (
                    <div className="mission-row" key={p.key}>
                      <div>
                        <strong className="flex items-center gap-1.5">
                          <StatusDot ok={p.running} />
                          {p.label}
                        </strong>
                        <span>{p.detail}</span>
                      </div>
                      <span
                        className={cn(
                          'mission-status-pill',
                          p.running
                            ? 'mission-status-live'
                            : 'mission-status-offline'
                        )}
                      >
                        {p.running ? 'Live' : 'Offline'}
                      </span>
                    </div>
                  ))}
                  {platforms.length === 0 && (
                    <div className="mission-empty">
                      No platforms detected.
                    </div>
                  )}
                </div>
              </section>

              <section className="mission-panel">
                <div className="mission-panel-title">
                  <div>
                    <h2>Paths & Config</h2>
                  </div>
                </div>
                <div className="mission-list">
                  <div className="mission-row">
                    <div>
                      <strong>Hermes Home</strong>
                      <span className="font-mono text-xs">
                        {status.hermes_home}
                      </span>
                    </div>
                  </div>
                  <div className="mission-row">
                    <div>
                      <strong>Config</strong>
                      <span className="font-mono text-xs">
                        {status.config_path}
                      </span>
                    </div>
                  </div>
                  <div className="mission-row">
                    <div>
                      <strong>Environment</strong>
                      <span className="font-mono text-xs">
                        {status.env_path}
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </div>
      )}

      {tab === 'services' && (
        <div className="mission-control-room">
          {/* Platforms */}
          <section className="mission-panel">
            <div className="mission-panel-title">
              <div>
                <span className="text-xs uppercase tracking-wider text-(--ui-text-tertiary)">
                  {livePlatforms}/{platforms.length} active
                </span>
                <h2>Platforms</h2>
              </div>
            </div>
            <div className="mission-list">
              {platforms.map(p => (
                <div className="mission-row" key={p.key}>
                  <div>
                    <strong className="flex items-center gap-1.5">
                      <StatusDot ok={p.running} />
                      {p.label}
                    </strong>
                    <span>{p.detail}</span>
                  </div>
                  <span
                    className={cn(
                      'mission-status-pill',
                      p.running
                        ? 'mission-status-live'
                        : 'mission-status-offline'
                    )}
                  >
                    {p.running ? 'Live' : 'Offline'}
                  </span>
                </div>
              ))}
              {platforms.length === 0 && (
                <div className="mission-empty">
                  No platforms detected.
                </div>
              )}
            </div>
          </section>

          {/* Cron Jobs */}
          <section className="mission-panel">
            <div className="mission-panel-title">
              <div>
                <span className="text-xs uppercase tracking-wider text-(--ui-text-tertiary)">
                  {cronJobs?.length ?? 0} jobs
                </span>
                <h2>Cron Jobs</h2>
              </div>
            </div>
            <div className="mission-list">
              {(cronJobs ?? []).map(job => (
                <div className="mission-row" key={job.id}>
                  <div>
                    <strong className="flex items-center gap-1.5">
                      <StatusDot ok={job.enabled} />
                      {job.name || job.id.slice(0, 12)}
                    </strong>
                    <span>{job.schedule_display || job.schedule?.display || 'No schedule'}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={cn(
                        'mission-status-pill',
                        job.enabled
                          ? 'mission-status-live'
                          : 'mission-status-offline'
                      )}
                    >
                      {job.enabled ? 'Active' : 'Disabled'}
                    </span>
                    {job.next_run_at && (
                      <time className="text-xs text-(--ui-text-tertiary) tabular-nums">
                        Next: {fmtTime(job.next_run_at)}
                      </time>
                    )}
                  </div>
                </div>
              ))}
              {(!cronJobs || cronJobs.length === 0) && (
                <div className="mission-empty">
                  No cron jobs configured.
                </div>
              )}
            </div>
          </section>

          {/* API Info */}
          <section className="mission-panel">
            <div className="mission-panel-title">
              <div>
                <h2>API</h2>
              </div>
            </div>
            <div className="mission-list">
              <div className="mission-row">
                <div>
                  <strong className="flex items-center gap-1.5">
                    <StatusDot ok={!!status?.gateway_running} />
                    Gateway
                  </strong>
                  <span>{status?.gateway_running ? 'Connected' : 'Disconnected'}</span>
                </div>
                <span
                  className={cn(
                    'mission-status-pill',
                    status?.gateway_running
                      ? 'mission-status-live'
                      : 'mission-status-offline'
                  )}
                >
                  {status?.gateway_running ? 'Live' : 'Offline'}
                </span>
              </div>
              {status && (
                <div className="mission-row">
                  <div>
                    <strong>Version</strong>
                    <span>{status.version}</span>
                  </div>
                  <div>
                    <strong className="text-xs">Config</strong>
                    <span className="text-xs">v{status.config_version}</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === 'sessions' && (
        <section className="mission-panel">
          <div className="mission-panel-title">
            <div>
              <span className="text-xs uppercase tracking-wider text-(--ui-text-tertiary)">
                {sessions?.sessions?.length ?? 0} total
              </span>
              <h2>Recent Sessions</h2>
            </div>
            <button
              className="mission-link-button"
              onClick={() => host.navigate('/')}
            >
              Open Chat
            </button>
          </div>
          <div className="mission-list">
            {(sessions?.sessions ?? []).slice(0, 5).map(s => (
              <div
                className="mission-row mission-row-clickable"
                key={s.id}
                onClick={() => host.navigate(`/?session=${s.id}`)}
                role="button"
                tabIndex={0}
              >
                <div>
                  <strong>
                    {s.title || `Session ${s.id.slice(0, 8)}`}
                  </strong>
                  <span>
                    {s.message_count} messages · {s.model || 'unknown model'}
                  </span>
                </div>
                <time className="text-xs text-(--ui-text-tertiary) tabular-nums">
                  {fmtTime(s.created_at)}
                </time>
              </div>
            ))}
            {(!sessions?.sessions || sessions.sessions.length === 0) && (
              <div className="mission-empty">
                No sessions yet. Start a chat to create one.
              </div>
            )}
          </div>
        </section>
      )}

      {tab === 'workspace' && (
        <>
          <section className="mission-panel">
            <div className="mission-panel-title">
              <div>
                <h2>Quick Launch</h2>
              </div>
            </div>
            <div className="mission-bucket-grid">
              <button onClick={() => host.navigate('/')}>
                <strong><Codicon name="comment-discussion" size="1rem" /> Chat</strong>
                <span>New conversation</span>
              </button>
              <button onClick={() => host.navigate('/command-center')}>
                <strong><Codicon name="terminal" size="1rem" /> Terminal</strong>
                <span>Shell access</span>
              </button>
              <button onClick={() => host.navigate('/kanban')}>
                <strong><Codicon name="project" size="1rem" /> Kanban</strong>
                <span>Task boards</span>
              </button>
              <button onClick={() => host.navigate('/command-center?section=settings')}>
                <strong><Codicon name="settings-gear" size="1rem" /> Settings</strong>
                <span>Configuration</span>
              </button>
              <button onClick={() => host.navigate('/self')}>
                <strong><Codicon name="person" size="1rem" /> Self</strong>
                <span>Journal & Vault</span>
              </button>
              <button onClick={() => host.navigate('/seo')}>
                <strong><Codicon name="globe" size="1rem" /> SEO</strong>
                <span>Pipeline</span>
              </button>
              <button onClick={() => host.navigate('/agents')}>
                <strong><Codicon name="hubot" size="1rem" /> AI CLIs</strong>
                <span>Local wrappers</span>
              </button>
              <button onClick={() => host.navigate('/skills')}>
                <strong><Codicon name="extensions" size="1rem" /> Skills</strong>
                <span>Capabilities</span>
              </button>
              <button onClick={() => host.navigate('/artifacts')}>
                <strong><Codicon name="file-media" size="1rem" /> Artifacts</strong>
                <span>Saved files</span>
              </button>
            </div>
          </section>

          <section className="mission-panel">
            <div className="mission-panel-title">
              <div>
                <span className="text-xs uppercase tracking-wider text-(--ui-text-tertiary)">
                  CLI & Terminal
                </span>
                <h2>Terminal Tools</h2>
              </div>
              <button
                className="mission-link-button"
                onClick={() => host.navigate('/command-center')}
              >
                Open Terminal
              </button>
            </div>
            <div className="mission-bucket-grid">
              {TERMINAL_TOOLS.map(tool => (
                <button
                  key={tool.cmd}
                  onClick={() => {
                    navigator.clipboard.writeText(tool.cmd).then(
                      () => host.notify({ title: 'Copied', message: `${tool.cmd} — paste in terminal` }),
                      () => host.notify({ title: tool.label, message: `Run: ${tool.cmd}` })
                    )
                    host.navigate('/command-center')
                  }}
                >
                  <strong><Codicon name={tool.icon} size="1rem" /> {tool.label}</strong>
                  <span>{tool.desc}</span>
                  <code className="mt-1 block text-[0.65rem] opacity-60">{tool.cmd}</code>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
