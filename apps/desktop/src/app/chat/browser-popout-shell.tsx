import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { ErrorBoundary } from '@/components/error-boundary'
import { HapticsProvider } from '@/components/haptics-provider'
import { RootTooltipProvider } from '@/components/ui/tooltip'
import { I18nProvider } from '@/i18n'
import { queryClient } from '@/lib/query-client'
import type { PreviewTarget } from '@/store/preview'
import { ThemeProvider } from '@/themes/context'

import { PreviewPane } from './right-rail/preview-pane'

/**
 * Standalone popped-out Browser window (`?win=browser&url=…`). It reuses the
 * right-rail PreviewPane with a Browser target, so the address bar, webview and
 * navigation behave exactly as the docked tab — just full-window and detached.
 * No `tabId` is passed: a popped window owns no docked tab, so it neither
 * persists navigation back nor offers a pop-out-of-a-pop-out.
 */
function BrowserPopoutApp() {
  const url = new URLSearchParams(window.location.search).get('url') || 'about:blank'
  const target: PreviewTarget = { browser: true, kind: 'url', label: 'Browser', source: url, url }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-(--ui-editor-surface-background)">
      <PreviewPane embedded target={target} />
    </div>
  )
}

export function mountBrowserPopout() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary label="browser-popout">
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <ThemeProvider>
              <HapticsProvider>
                <RootTooltipProvider>
                  <BrowserPopoutApp />
                </RootTooltipProvider>
              </HapticsProvider>
            </ThemeProvider>
          </I18nProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>
  )
}
