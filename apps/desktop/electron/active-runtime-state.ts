export interface BootstrapMarkerLike {
  pinnedCommit?: unknown
  schemaVersion?: unknown
}

export interface ActiveRuntimeState {
  hasValidMarker: boolean
  shouldUseActiveRuntime: boolean
  usabilityReason: 'marker-trusted' | 'unusable' | 'usable'
}

export function hasValidBootstrapMarker(
  marker: BootstrapMarkerLike | null | undefined,
  schemaVersion: number
): boolean {
  if (!marker || typeof marker !== 'object') {
    return false
  }

  if (marker.schemaVersion !== schemaVersion) {
    return false
  }

  if (typeof marker.pinnedCommit !== 'string' || marker.pinnedCommit.length < 7) {
    return false
  }

  return true
}

// The active install at ~/.hermes/hermes-agent can be real and runnable even if
// Desktop never wrote its first-run bootstrap marker (for example when Hermes
// was installed by the CLI first, or when a past desktop build forgot the
// marker). Runtime usability is authoritative for "can we launch local Hermes
// right now?"; the marker is only provenance about how that install was
// created. A missing/stale marker must never force a healthy local install into
// the first-run bootstrap UI.
//
// The symmetric failure is just as bad: the live usability probe
// (`import hermes_cli.config`) can FALSE-NEGATIVE under process contention — a
// cold launch that spawns several profile backends at once can starve the probe
// subprocess into its timeout even though the runtime is perfectly healthy.
// Letting that drop a demonstrably-installed runtime onto the reinstall screen
// is the worse outcome. So when the probe says "unusable" but a VALID bootstrap
// marker AND the install are present on disk (`installPresent`), trust the
// marked install and launch it; a genuinely broken runtime still fails loudly
// and recoverably at spawn, not with a spurious first-run prompt.
export function classifyActiveRuntime(
  marker: BootstrapMarkerLike | null | undefined,
  schemaVersion: number,
  runtimeUsable: boolean,
  installPresent = false
): ActiveRuntimeState {
  const hasValidMarker = hasValidBootstrapMarker(marker, schemaVersion)

  if (runtimeUsable) {
    return {
      hasValidMarker,
      shouldUseActiveRuntime: true,
      usabilityReason: 'usable'
    }
  }

  if (hasValidMarker && installPresent) {
    return {
      hasValidMarker,
      shouldUseActiveRuntime: true,
      usabilityReason: 'marker-trusted'
    }
  }

  return {
    hasValidMarker,
    shouldUseActiveRuntime: false,
    usabilityReason: 'unusable'
  }
}
