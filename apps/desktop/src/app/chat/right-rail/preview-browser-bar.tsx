import { useEffect, useState } from 'react'

import { Codicon } from '@/components/ui/codicon'
import { CopyButton } from '@/components/ui/copy-button'
import { Input } from '@/components/ui/input'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * Turn what the user typed into something a webview can load: an explicit URL
 * (with scheme) as-is, a bare host (`example.com`, `localhost:3000`) promoted to
 * https, and anything else routed to a web search. Returns null for blank input.
 */
export function resolveTypedLocation(raw: string): null | string {
  const value = raw.trim()

  if (!value) {
    return null
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || value.startsWith('about:')) {
    return value
  }

  // A single token that looks like a host (has a dot or a :port, no spaces).
  const looksLikeHost = !/\s/.test(value) && (/\.[a-z]{2,}(?:[/:?#]|$)/i.test(value) || /^localhost(?::\d+)?/i.test(value))

  if (looksLikeHost) {
    return `https://${value}`
  }

  return `https://www.google.com/search?q=${encodeURIComponent(value)}`
}

interface PreviewBrowserBarProps {
  canGoBack: boolean
  canGoForward: boolean
  loading: boolean
  /** The address the webview is actually showing right now. */
  url: string
  onBack: () => void
  onForward: () => void
  onNavigate: (url: string) => void
  /** Pop this tab into its own window. Omitted when the host can't host one. */
  onPopOut?: () => void
  onReloadOrStop: () => void
}

export function PreviewBrowserBar({
  canGoBack,
  canGoForward,
  loading,
  url,
  onBack,
  onForward,
  onNavigate,
  onPopOut,
  onReloadOrStop
}: PreviewBrowserBarProps) {
  const { t } = useI18n()
  const copy = t.preview
  const [draft, setDraft] = useState(url)
  const [editing, setEditing] = useState(false)

  // Follow the live location unless the user is mid-edit in the field.
  useEffect(() => {
    if (!editing) {
      setDraft(url === 'about:blank' ? '' : url)
    }
  }, [url, editing])

  const submit = () => {
    const resolved = resolveTypedLocation(draft)

    if (resolved) {
      onNavigate(resolved)
    }
  }

  const iconButton =
    'grid size-6 shrink-0 place-items-center rounded-md text-(--ui-text-tertiary) transition-colors hover:bg-(--ui-control-hover-background) hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-(--ui-text-tertiary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring [-webkit-app-region:no-drag]'

  return (
    <div className="flex min-h-(--titlebar-height) items-center gap-1 border-b border-border/60 bg-background px-1.5 py-1">
      <Tip label={copy.browserBack}>
        <button aria-label={copy.browserBack} className={iconButton} disabled={!canGoBack} onClick={onBack} type="button">
          <Codicon name="arrow-left" size="0.8125rem" />
        </button>
      </Tip>
      <Tip label={copy.browserForward}>
        <button
          aria-label={copy.browserForward}
          className={iconButton}
          disabled={!canGoForward}
          onClick={onForward}
          type="button"
        >
          <Codicon name="arrow-right" size="0.8125rem" />
        </button>
      </Tip>
      <Tip label={loading ? copy.browserStop : copy.browserReload}>
        <button
          aria-label={loading ? copy.browserStop : copy.browserReload}
          className={iconButton}
          onClick={onReloadOrStop}
          type="button"
        >
          <Codicon name={loading ? 'close' : 'refresh'} size="0.8125rem" />
        </button>
      </Tip>

      <Input
        aria-label={copy.browserAddressPlaceholder}
        className={cn('h-6 min-w-0 flex-1 px-2 text-xs')}
        onBlur={() => setEditing(false)}
        onChange={event => setDraft(event.target.value)}
        onFocus={event => {
          setEditing(true)
          event.target.select()
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault()
            submit()
            ;(event.target as HTMLInputElement).blur()
          }
        }}
        placeholder={copy.browserAddressPlaceholder}
        spellCheck={false}
        value={draft}
      />

      <CopyButton
        appearance="icon"
        buttonSize="icon-xs"
        className="shrink-0"
        iconClassName="size-3.5"
        label={copy.browserCopyUrl}
        text={url === 'about:blank' ? '' : url}
      />

      {onPopOut && (
        <Tip label={copy.browserPopOut}>
          <button aria-label={copy.browserPopOut} className={iconButton} onClick={onPopOut} type="button">
            <Codicon name="link-external" size="0.8125rem" />
          </button>
        </Tip>
      )}
    </div>
  )
}
