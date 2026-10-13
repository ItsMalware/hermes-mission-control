// Popped-out in-app Browser windows. Same query-before-hash contract as
// session-windows: `?win=browser` MUST sit in the search string before the
// '#', or HashRouter swallows it as part of the route.

import { pathToFileURL } from 'node:url'

export const BROWSER_WINDOW_WIDTH = 960
export const BROWSER_WINDOW_HEIGHT = 720
export const BROWSER_WINDOW_MIN_WIDTH = 480
export const BROWSER_WINDOW_MIN_HEIGHT = 400

/**
 * Renderer URL for a popped-out Browser showing `url`. The popped window is a
 * standalone browser (its own address bar + webview); the docked tab is handed
 * off at pop-out time, so no tab id needs to travel with it.
 */
export function buildBrowserWindowUrl(
  url: string,
  { devServer, rendererIndexPath }: { devServer?: null | string; rendererIndexPath?: string } = {}
): string {
  const query = `?win=browser&url=${encodeURIComponent(url || 'about:blank')}`

  if (devServer) {
    const base = devServer.endsWith('/') ? devServer.slice(0, -1) : devServer

    return `${base}/${query}#/`
  }

  return `${pathToFileURL(rendererIndexPath!).toString()}${query}#/`
}
