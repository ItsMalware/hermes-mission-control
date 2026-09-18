import { useState } from 'react'

import {
  Button,
  cn,
  Codicon,
  EmptyState,
  host,
  Loader,
  Tabs,
  TabsList,
  TabsTrigger,
  useQuery,
} from '@hermes/plugin-sdk'

import { Wallpaper } from '../wallpaper'

/* ── Types ── */

interface Project {
  id: string
  name: string
  description: string
  cwd: string
  status: 'active' | 'idle'
  lastAccessed: string
}

/* ── Quick-launch definitions ── */

const QUICK_ACTIONS = [
  { icon: 'comment-discussion', label: 'Chat', desc: 'Open a new chat session', path: '/' },
  { icon: 'terminal', label: 'Terminal', desc: 'Command center & shell', path: '/command-center' },
  { icon: 'layout', label: 'Kanban', desc: 'Task boards & sprints', path: '/kanban' },
  { icon: 'settings-gear', label: 'Settings', desc: 'App configuration', path: '/command-center?section=settings' },
  { icon: 'dashboard', label: 'Mission Control', desc: 'System overview', path: '/mission-control' },
  { icon: 'person', label: 'Self', desc: 'Journal & identity vault', path: '/self' },
  { icon: 'globe', label: 'SEO', desc: 'SEO pipeline tools', path: '/seo' },
  { icon: 'hubot', label: 'Agents', desc: 'Manage AI agents', path: '/agents' },
] as const

/* ── Integration definitions ── */

const INTEGRATIONS = [
  { key: 'notion', icon: 'notebook', label: 'Notion', desc: 'Sync project boards and documentation' },
  { key: 'github', icon: 'github', label: 'GitHub', desc: 'Link repositories and track PRs' },
  { key: 'linear', icon: 'issues', label: 'Linear', desc: 'Import issues and track sprints' },
] as const

type WorkspaceTab = 'projects' | 'quicklaunch' | 'integrations'

const LS_PREFIX = 'hmc-integration-'

function getConnected(key: string): boolean {
  try {
    return localStorage.getItem(`${LS_PREFIX}${key}`) === '1'
  } catch {
    return false
  }
}

/* ── Sub-components ── */

function ProjectsTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['workspace', 'projects'],
    queryFn: () =>
      host.request<{ projects: Project[] }>('workspace.listProjects', {}),
    refetchInterval: 30_000,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="workspace-loader">
        <Loader />
      </div>
    )
  }

  const projects = data?.projects

  if (isError || !projects || projects.length === 0) {
    return (
      <EmptyState
        title="No projects found"
        description="Projects will be available once workspace management is connected."
      />
    )
  }

  return (
    <div className="workspace-grid">
      {projects.map((p) => (
        <div key={p.id} className="workspace-card">
          <div className="workspace-card-header">
            <strong>{p.name}</strong>
            <span
              className={cn(
                'workspace-status-dot',
                p.status === 'active' ? 'active' : 'idle'
              )}
            />
          </div>
          {p.description && (
            <p className="workspace-card-desc">{p.description}</p>
          )}
          <span className="workspace-card-cwd">
            <Codicon name="folder" />
            {p.cwd}
          </span>
          <div className="workspace-card-footer">
            <span className="workspace-card-status">
              {p.status === 'active' ? 'Active' : 'Idle'}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => host.navigate('/')}
            >
              <Codicon name="link-external" />
              Open
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function QuickLaunchTab() {
  return (
    <div className="workspace-quick-grid">
      {QUICK_ACTIONS.map((a) => (
        <button
          key={a.path}
          className="workspace-quick-btn"
          onClick={() => host.navigate(a.path)}
        >
          <Codicon name={a.icon} size="1rem" />
          <div>
            <strong>{a.label}</strong>
            <span>{a.desc}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

function IntegrationsTab() {
  const [showStub, setShowStub] = useState<string | null>(null)

  return (
    <div className="workspace-grid">
      {INTEGRATIONS.map((i) => {
        const connected = getConnected(i.key)
        return (
          <div key={i.key} className="workspace-integration-card">
            <div className="workspace-integration-header">
              <Codicon name={i.icon} />
              <strong>{i.label}</strong>
              <span
                className={cn(
                  'workspace-status-dot',
                  connected ? 'active' : 'idle'
                )}
              />
            </div>
            <p className="workspace-card-desc">{i.desc}</p>
            <div className="workspace-card-footer">
              <span className="workspace-card-status">
                {connected ? 'Connected' : 'Not connected'}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowStub(i.key)}
              >
                {connected ? 'Manage' : 'Connect'}
              </Button>
            </div>
            {showStub === i.key && (
              <div className="workspace-stub">
                <EmptyState
                  title="Coming Soon"
                  description="Integration will be available in a future update."
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowStub(null)}
                >
                  Dismiss
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Main page ── */

export function WorkspacePage() {
  const [tab, setTab] = useState<WorkspaceTab>('projects')

  return (
    <div className="hmc-page">
      <Wallpaper />

      <div className="workspace-header">
        <div className="mission-eyebrow">
          <strong>Project Hub</strong>
          <i />
        </div>
        <h1>Workspace</h1>
        <p>Manage projects, quick actions, and integrations.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as WorkspaceTab)}>
        <TabsList>
          <TabsTrigger value="projects">
            <Codicon name="folder" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="quicklaunch">
            <Codicon name="rocket" />
            Quick Launch
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Codicon name="plug" />
            Integrations
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="workspace-content">
        {tab === 'projects' && <ProjectsTab />}
        {tab === 'quicklaunch' && <QuickLaunchTab />}
        {tab === 'integrations' && <IntegrationsTab />}
      </div>
    </div>
  )
}
