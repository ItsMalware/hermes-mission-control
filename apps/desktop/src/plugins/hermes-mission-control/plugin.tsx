import './mission-control.css'

import {
  type HermesPlugin,
  type RouteContribution,
  ROUTES_AREA,
  PALETTE_AREA,
  type PaletteContribution,
  host,
} from '@hermes/plugin-sdk'

import wallpaperUrl from './cozy-hermes-bg.webp'
import { AgentsPage } from './pages/agents'
import { MissionControlPage } from './pages/mission-control'
import { SelfPage } from './pages/self'
import { SEOPage } from './pages/seo'

function mountGlobalWallpaper() {
  if (localStorage.getItem('hermes.wallpaper') === 'off') return
  if (document.getElementById('hmc-global-wallpaper')) return
  const el = document.createElement('div')
  el.id = 'hmc-global-wallpaper'
  el.className = 'hmc-wallpaper'
  el.setAttribute('aria-hidden', 'true')
  el.style.backgroundImage = `url(${wallpaperUrl})`
  document.body.prepend(el)
}

const plugin: HermesPlugin = {
  id: 'hermes-mission-control',
  name: 'Hermes Mission Control',
  defaultEnabled: true,
  register(ctx) {
    mountGlobalWallpaper()
    ctx.registerMany([
      {
        id: 'mission-control',
        area: ROUTES_AREA,
        data: { path: '/mission-control' } satisfies RouteContribution,
        render: () => <MissionControlPage />,
      },
      {
        id: 'self',
        area: ROUTES_AREA,
        data: { path: '/self' } satisfies RouteContribution,
        render: () => <SelfPage />,
      },
      {
        id: 'seo',
        area: ROUTES_AREA,
        data: { path: '/seo' } satisfies RouteContribution,
        render: () => <SEOPage />,
      },
      {
        id: 'open-mission-control',
        area: PALETTE_AREA,
        data: {
          id: 'hermes.openMissionControl',
          label: 'Hermes: Mission Control',
          keywords: ['mission', 'control', 'dashboard', 'status'],
          run: () => host.navigate('/mission-control'),
        } satisfies PaletteContribution,
      },
      {
        id: 'open-self',
        area: PALETTE_AREA,
        data: {
          id: 'hermes.openSelf',
          label: 'Hermes: Self — Journal & Vault',
          keywords: ['self', 'journal', 'vault', 'obsidian', 'notes'],
          run: () => host.navigate('/self'),
        } satisfies PaletteContribution,
      },
      {
        id: 'open-seo',
        area: PALETTE_AREA,
        data: {
          id: 'hermes.openSeo',
          label: 'Hermes: SEO Pipeline',
          keywords: ['seo', 'pipeline', 'search', 'optimization'],
          run: () => host.navigate('/seo'),
        } satisfies PaletteContribution,
      },
      /* ── Profiles (AiClis) ── */
      {
        id: 'profiles',
        area: ROUTES_AREA,
        data: { path: '/ai-clis' } satisfies RouteContribution,
        render: () => <AgentsPage />,
      },
      {
        id: 'open-profiles',
        area: PALETTE_AREA,
        data: {
          id: 'hermes.openProfiles',
          label: 'Hermes: Profiles — Agent Management',
          keywords: ['profiles', 'agents', 'persona'],
          run: () => host.navigate('/ai-clis'),
        } satisfies PaletteContribution,
      },
    ])
  },
}

export default plugin
