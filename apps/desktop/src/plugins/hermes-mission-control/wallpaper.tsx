import { atom } from '@hermes/plugin-sdk'

export const $wallpaperEnabled = atom(
  typeof localStorage !== 'undefined'
    ? localStorage.getItem('hermes.wallpaper') !== 'off'
    : true
)

$wallpaperEnabled.subscribe(on => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('hermes.wallpaper', on ? 'on' : 'off')
  }
})

/**
 * No-op: the wallpaper is a SINGLE global layer mounted once on the body by the
 * plugin's `mountGlobalWallpaper()`. Pages used to render their own `<Wallpaper/>`
 * too, which stacked a second fixed full-viewport copy — doubling the effective
 * opacity on plugin pages (darker sidebar + surfaces) and making them not match
 * the chat tab, which has only the global one. Rendering nothing keeps every tab
 * on the one shared wallpaper.
 */
export function Wallpaper() {
  return null
}
