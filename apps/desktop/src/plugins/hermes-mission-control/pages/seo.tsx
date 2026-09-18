import { useEffect, useRef, useState, useCallback } from 'react'
import { Codicon } from '@hermes/plugin-sdk'
import { Wallpaper } from '../wallpaper'

const SETTING_KEY = 'seoUrl'
const LS_KEY = 'hermes-openseo-url'
const DEFAULT_URL = 'http://127.0.0.1:3001'
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

function isAllowedUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol === 'https:') return true
    if (url.protocol !== 'http:') return false
    if (!LOCAL_HOSTS.has(url.hostname)) return false
    const port = Number(url.port)
    return Number.isInteger(port) && port >= 1024 && port <= 65535
  } catch {
    return false
  }
}

function persistUrl(url: string): void {
  localStorage.setItem(LS_KEY, url)
  window.hermesDesktop?.pluginSetting?.set(SETTING_KEY, url).catch(() => {})
}

function loadPersistedUrl(): string {
  return localStorage.getItem(LS_KEY) || DEFAULT_URL
}

type Status = 'loading' | 'ready' | 'error'

export function SEOEmbed() {
  const [url, setUrl] = useState(loadPersistedUrl)
  const [draftUrl, setDraftUrl] = useState(url)
  const [status, setStatus] = useState<Status>('loading')
  const [showSettings, setShowSettings] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const validUrl = isAllowedUrl(url)

  // Reset status when URL or attempt changes
  useEffect(() => {
    if (validUrl) setStatus('loading')
  }, [url, attempt, validUrl])

  const handleLoad = useCallback(() => setStatus('ready'), [])
  const handleError = useCallback(() => setStatus('error'), [])

  function applyUrl(): void {
    const next = draftUrl.trim()
    if (!isAllowedUrl(next)) return
    persistUrl(next)
    setUrl(next)
    setStatus('loading')
    setShowSettings(false)
    setAttempt((n) => n + 1)
  }

  function retry(): void {
    setStatus('loading')
    setAttempt((n) => n + 1)
  }

  const draftOk = isAllowedUrl(draftUrl.trim())

  return (
    <div className="seo-embed">
        {/* Toolbar */}
        <div className="seo-toolbar">
          <span className="seo-toolbar-title">
            <Codicon name="globe" size="0.85rem" /> OpenSEO
          </span>
          <span className="seo-toolbar-url" title={url}>
            {url}
          </span>
          <div className="seo-toolbar-actions">
            <button type="button" title="Reload" onClick={retry} className="seo-toolbar-btn">
              <Codicon name="refresh" size="0.85rem" />
            </button>
            <button
              type="button"
              title="Open in browser"
              onClick={() => window.open(url, '_blank')}
              className="seo-toolbar-btn"
            >
              <Codicon name="link-external" size="0.85rem" />
            </button>
            <button
              type="button"
              title="Settings"
              onClick={() => {
                setDraftUrl(url)
                setShowSettings((v) => !v)
              }}
              className="seo-toolbar-btn"
            >
              <Codicon name="settings-gear" size="0.85rem" />
            </button>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="seo-settings">
            <label htmlFor="openseo-url">OpenSEO URL</label>
            <div className="seo-settings-row">
              <input
                id="openseo-url"
                type="text"
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                placeholder={DEFAULT_URL}
                spellCheck={false}
                className="seo-settings-input"
              />
              <button
                type="button"
                onClick={applyUrl}
                disabled={!draftOk}
                className="seo-settings-save"
              >
                Save &amp; reload
              </button>
            </div>
            {!draftOk && draftUrl.trim() !== '' && (
              <p className="seo-settings-hint">
                Enter a local http URL (port 1024-65535) or a remote https URL.
              </p>
            )}
          </div>
        )}

        {/* Content area */}
        {!validUrl || status === 'error' ? (
          <div className="seo-error">
            <Codicon name="warning" size="1.5rem" />
            <h3>Cannot reach OpenSEO</h3>
            {validUrl ? (
              <p>
                Nothing is responding at <code>{url}</code>. Start OpenSEO
                locally (see the OpenSEO Setup section in the README), then
                retry.
              </p>
            ) : (
              <p>
                The configured URL is not valid. Open settings above and enter a
                local http URL (e.g. <code>{DEFAULT_URL}</code>).
              </p>
            )}
            <button type="button" onClick={retry} className="seo-error-retry">
              Retry
            </button>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            key={`${url}#${attempt}`}
            src={url}
            className="seo-iframe"
            onLoad={handleLoad}
            onError={handleError}
            title="OpenSEO"
          />
        )}

        {/* Loading overlay */}
        {validUrl && status === 'loading' && (
          <div className="seo-loading">Loading OpenSEO...</div>
        )}
    </div>
  )
}

export function SEOPage() {
  return (
    <div className="hmc-page">
      <Wallpaper />
      <h1 className="hmc-page-title">SEO Pipeline</h1>
      <SEOEmbed />
    </div>
  )
}
