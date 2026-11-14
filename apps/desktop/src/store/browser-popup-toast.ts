import { translateNow } from '@/i18n'

import { notify } from './notifications'

// The in-app Browser auto-allows popups (sign-in / SSO windows), but a new
// window can open behind the app or on another display. The main process emits
// `hermes:browser-popup-opened` when it allows one (see the web-contents-created
// window-open handler in electron/main.ts); surface it as a toast so the user
// always SEES that a popup opened, and for which site — never a silent block.
if (typeof window !== 'undefined') {
  try {
    window.hermesDesktop?.browserPopout?.onOpened?.(info => {
      const base = translateNow('preview.browserPopupOpened')

      notify({ kind: 'info', message: info?.host ? `${base} — ${info.host}` : base })
    })
  } catch {
    // Non-fatal: no popup toasts if the bridge is unavailable.
  }
}
