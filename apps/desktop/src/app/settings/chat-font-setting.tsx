import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { saveHermesConfig } from '@/hermes'
import { useI18n } from '@/i18n'
import { notifyError } from '@/store/notifications'
import {
  CHAT_FONT_SUGGESTIONS,
  normalizeChatFontFamily,
  setChatFontFamilyFromConfig
} from '@/themes/chat-font'
import type { HermesConfigRecord } from '@/types/hermes'

import { setHermesConfigCache, useHermesConfigRecord } from '../hooks/use-config-record'
import { useOnProfileSwitch } from '../hooks/use-on-profile-switch'

import { ComboboxInput } from './combobox-input'
import { getNested, setNested } from './helpers'
import { ListRow } from './primitives'

const AUTOSAVE_DELAY_MS = 550
const CONFIG_PATH = 'desktop.font_family'

function fontFamilyFromConfig(config: HermesConfigRecord): string {
  return normalizeChatFontFamily(getNested(config, CONFIG_PATH))
}

/**
 * Chat / UI face picker. Same seed → autosave → rollback contract as
 * {@link TerminalFontSetting}; the live value publishes through
 * `$chatFontFamily`, which the theme paint reads so `--dt-font-sans` follows
 * every keystroke (see themes/context.tsx).
 */
export function ChatFontSetting() {
  const { t } = useI18n()
  const copy = t.settings.appearance
  const { data: loadedConfig } = useHermesConfigRecord()
  // draft === null ⇔ unseeded: nothing painted yet for this profile. Mirrors
  // TerminalFontSetting's staleConfig guard so the previous profile's cached
  // record can't repopulate the field across a profile switch.
  const [draft, setDraft] = useState<string | null>(null)
  const [staleConfig, setStaleConfig] = useState<HermesConfigRecord | null>(null)
  const [saveVersion, setSaveVersion] = useState(0)
  const saveVersionRef = useRef(0)

  const cancelPendingSave = () => {
    saveVersionRef.current = 0
  }

  useEffect(() => {
    if (!loadedConfig || draft !== null || loadedConfig === staleConfig) {
      return
    }

    const value = fontFamilyFromConfig(loadedConfig)
    setDraft(value)
    setChatFontFamilyFromConfig(value)
  }, [draft, loadedConfig, staleConfig])

  useOnProfileSwitch(() => {
    saveVersionRef.current += 1
    setDraft(null)
    setStaleConfig(loadedConfig ?? null)
    setSaveVersion(0)
    // Do not show the previous profile's font while the new profile loads.
    setChatFontFamilyFromConfig('')
  })

  useEffect(() => {
    if (draft === null || saveVersion === 0 || !loadedConfig) {
      return
    }

    const version = saveVersion
    const value = normalizeChatFontFamily(draft)

    if (value === fontFamilyFromConfig(loadedConfig)) {
      return
    }

    const rollback = fontFamilyFromConfig(loadedConfig)

    const timeout = window.setTimeout(() => {
      const next = setNested(loadedConfig, CONFIG_PATH, value)

      void saveHermesConfig(next)
        .then(result => {
          if (!result.ok) {
            throw new Error(t.settings.config.autosaveFailed)
          }

          if (saveVersionRef.current !== version) {
            return
          }

          setHermesConfigCache(next)
        })
        .catch(error => {
          if (saveVersionRef.current !== version) {
            return
          }

          cancelPendingSave()
          setSaveVersion(0)
          setDraft(rollback)
          setChatFontFamilyFromConfig(rollback)
          notifyError(error, t.settings.config.autosaveFailed)
        })
    }, AUTOSAVE_DELAY_MS)

    return () => window.clearTimeout(timeout)
  }, [draft, loadedConfig, saveVersion, t.settings.config.autosaveFailed])

  const update = (value: string) => {
    saveVersionRef.current += 1
    setDraft(value)
    setSaveVersion(saveVersionRef.current)
    setChatFontFamilyFromConfig(value)
  }

  const value = draft ?? ''

  return (
    <ListRow
      below={
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3">
            <ComboboxInput
              className="flex-1"
              onChange={update}
              options={[...CHAT_FONT_SUGGESTIONS]}
              placeholder={copy.chatFontPlaceholder}
              value={value}
            />
            <Button disabled={!value || draft === null} onClick={() => update('')} size="inline" variant="text">
              {copy.chatFontReset}
            </Button>
          </div>
          {/* Inherits --dt-font-sans, so it IS the live result, not a simulation. */}
          <div
            aria-label={copy.chatFontPreview}
            className="overflow-hidden px-1 py-2 text-sm text-(--ui-text-secondary)"
          >
            <span className="mr-2 text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)">
              {copy.chatFontPreview}
            </span>
            <span>{copy.chatFontSample}</span>
          </div>
        </div>
      }
      description={copy.chatFontDesc}
      title={copy.chatFontTitle}
      wide
    />
  )
}
