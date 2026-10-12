/**
 * Message bubble transparency — how much of your own bubble's fill shows.
 *
 * One 0–100 lever, same direction as Window Translucency: 0 keeps the bubble
 * solid (default), 100 leaves only the outline. Presentation-only, so the
 * renderer owns it (desktop AGENTS.md: state lives with its authority) and
 * paints it as ONE root variable — `--user-bubble-keep`, the share of the
 * theme's bubble fill to keep — that `--dt-user-bubble` mixes in (styles.css).
 * The bubble and the inline edit composer share that token, so both follow.
 */

import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

const KEY = 'hermes.desktop.user-bubble-transparency.v1'

const MIN = 0
const MAX = 100

const clamp = (n: number): number => Math.min(MAX, Math.max(MIN, Math.round(n)))

const read = (): number => {
  const n = Number(storedString(KEY))

  return Number.isFinite(n) ? clamp(n) : MIN
}

export const $userBubbleTransparency = atom<number>(typeof window === 'undefined' ? MIN : read())

export function setUserBubbleTransparency(value: number): void {
  $userBubbleTransparency.set(clamp(value))
}

if (typeof window !== 'undefined') {
  $userBubbleTransparency.subscribe(value => {
    const root = document.documentElement

    // The default paints nothing: styles.css falls back to the full fill, so a
    // user who never touched the lever gets byte-identical CSS to before.
    if (value === MIN) {
      root.style.removeProperty('--user-bubble-keep')
      persistString(KEY, null)
    } else {
      root.style.setProperty('--user-bubble-keep', `${MAX - value}%`)
      persistString(KEY, String(value))
    }
  })
}
