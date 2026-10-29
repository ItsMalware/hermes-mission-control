// Second-level nav under Settings ▸ Appearance. Selecting the Appearance tab
// reveals these subpages; each renders only its slice of AppearanceSettings
// (see its `subpage` prop). labelKey indexes t.settings.subpages.
export const APPEARANCE_SUBPAGES = [
  { id: 'general', labelKey: 'appearanceGeneral' },
  { id: 'theme', labelKey: 'appearanceTheme' },
  { id: 'typography', labelKey: 'appearanceTypography' },
  { id: 'window-layout', labelKey: 'appearanceWindowLayout' },
  { id: 'chat-display', labelKey: 'appearanceChatDisplay' },
  { id: 'pet', labelKey: 'appearancePet' }
] as const

export type AppearanceSubpageId = (typeof APPEARANCE_SUBPAGES)[number]['id']

export const APPEARANCE_SUBPAGE_IDS = APPEARANCE_SUBPAGES.map(page => page.id) as readonly AppearanceSubpageId[]
