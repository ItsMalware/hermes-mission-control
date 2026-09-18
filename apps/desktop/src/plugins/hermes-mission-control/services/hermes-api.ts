/**
 * Thin adapter that re-exports the Hermes REST API functions and types
 * needed by Mission Control pages, keeping import paths centralised.
 */

import { host } from '@hermes/plugin-sdk'

export { getProfiles, createProfile, deleteProfile } from '@/hermes'
export { getMemoryStatus, resetMemory, getMemoryProviderConfig, saveMemoryProviderConfig } from '@/hermes'
export { getHermesConfig, saveHermesConfig, getUsageAnalytics } from '@/hermes'
export { getGlobalModelInfo, getGlobalModelOptions, setGlobalModel } from '@/hermes'
export { getCronJobs } from '@/hermes'
export type { CronJob } from '@/types/hermes'
export type { ProfileInfo, ProfileCreatePayload, ProfilesResponse } from '@/types/hermes'
export type { MemoryStatusResponse, MemoryProviderConfig, MemoryProviderField } from '@/types/hermes'
export type { HermesConfig, HermesConfigRecord, ModelInfoResponse, ModelOptionsResponse } from '@/types/hermes'

/** Activate a profile on the desktop app. */
export async function setActiveProfile(name: string): Promise<void> {
  await window.hermesDesktop.profile.set(name)
}

/** Navigate the plugin host back to the chat view. */
export function navigateToChat(): void {
  host.navigate('/')
}
