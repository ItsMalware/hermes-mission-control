import { atom, useValue } from '@hermes/plugin-sdk'

import wallpaperUrl from './cozy-hermes-bg.webp'

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

export function Wallpaper() {
  const on = useValue($wallpaperEnabled)
  if (!on) return null

  return (
    <div
      aria-hidden
      className="hmc-wallpaper"
      style={{ backgroundImage: `url(${wallpaperUrl})` }}
    />
  )
}
