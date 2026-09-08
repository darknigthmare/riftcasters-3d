import type { Affinity, AffinityId, AffinityUnlocks } from './types';
import { defaultCareer, sanitizeCareer, type Career } from './career';
import { sanitizeCheckpoint, type RunCheckpoint } from './checkpoint';

export const PROGRESSION_STORAGE_KEY = 'riftcasters-save-v2';
export const LEGACY_STORAGE_KEY = 'riftcasters-save-v1';

export type ProgressionProfile = {
  version: 2;
  highScore: number;
  dust: number;
  muted: boolean;
  runsCompleted: number;
  victories: number;
  unlockedAffinities: AffinityUnlocks;
  equippedAffinity: Affinity;
  career: Career;
  checkpoint: RunCheckpoint | null;
};

const AFFINITY_COSTS: Record<AffinityId, number> = {
  braise: 14,
  prisme: 14,
  neant: 18,
};

export function createDefaultProfile(): ProgressionProfile {
  return {
    version: 2,
    highScore: 0,
    dust: 0,
    muted: false,
    runsCompleted: 0,
    victories: 0,
    unlockedAffinities: {
      braise: false,
      prisme: false,
      neant: false,
    },
    equippedAffinity: 'none',
    career: defaultCareer(),
    checkpoint: null,
  };
}

function finiteNonNegativeInteger(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function parseCandidate(
  raw: string,
  source: 'current' | 'legacy',
): ProgressionProfile | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ProgressionProfile>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    if (source === 'current' && parsed.version !== 2) return null;
    if (
      source === 'current' &&
      ![
        'highScore',
        'dust',
        'muted',
        'runsCompleted',
        'victories',
        'unlockedAffinities',
        'equippedAffinity',
      ].every((key) => Object.prototype.hasOwnProperty.call(parsed, key))
    ) {
      return null;
    }
    if (
      source === 'legacy' &&
      !['highScore', 'dust', 'muted'].some((key) =>
        Object.prototype.hasOwnProperty.call(parsed, key),
      )
    ) {
      return null;
    }
    const defaults = createDefaultProfile();
    const unlockedAffinities: AffinityUnlocks = {
      braise: parsed.unlockedAffinities?.braise === true,
      prisme: parsed.unlockedAffinities?.prisme === true,
      neant: parsed.unlockedAffinities?.neant === true,
    };
    const requestedAffinity = parsed.equippedAffinity;
    const equippedAffinity: Affinity =
      requestedAffinity === 'braise' ||
      requestedAffinity === 'prisme' ||
      requestedAffinity === 'neant'
        ? unlockedAffinities[requestedAffinity]
          ? requestedAffinity
          : 'none'
        : 'none';
    const runsCompleted = finiteNonNegativeInteger(parsed.runsCompleted);
    return {
      ...defaults,
      highScore: finiteNonNegativeInteger(parsed.highScore),
      dust: finiteNonNegativeInteger(parsed.dust),
      muted: parsed.muted === true,
      runsCompleted,
      victories: Math.min(
        runsCompleted,
        finiteNonNegativeInteger(parsed.victories),
      ),
      unlockedAffinities,
      equippedAffinity,
      career: sanitizeCareer(parsed.career),
      checkpoint: sanitizeCheckpoint(parsed.checkpoint),
    };
  } catch {
    return null;
  }
}

export function isValidCurrentProgression(raw: string | null) {
  return raw ? parseCandidate(raw, 'current') !== null : false;
}

export function readProgression(
  currentRaw: string | null,
  legacyRaw: string | null,
) {
  if (currentRaw) {
    const current = parseCandidate(currentRaw, 'current');
    if (current) return current;
  }
  if (legacyRaw) {
    const legacy = parseCandidate(legacyRaw, 'legacy');
    if (legacy) return legacy;
  }
  return createDefaultProfile();
}

export function affinityUnlockCost(affinity: AffinityId) {
  return AFFINITY_COSTS[affinity];
}

export function recalibrationCost(rerollsThisRun: number) {
  const safeCount = finiteNonNegativeInteger(rerollsThisRun);
  return Math.min(20, 4 + safeCount * 4);
}

export function calculateDustReward({
  score,
  riftsStabilized,
  victory,
}: {
  score: number;
  riftsStabilized: number;
  victory: boolean;
}) {
  const rifts = finiteNonNegativeInteger(riftsStabilized);
  if (rifts === 0) return 0;
  const rewardedScore = Math.min(
    finiteNonNegativeInteger(score),
    rifts * 8_500,
  );
  return Math.floor(rewardedScore / 850) + rifts * 2 + (victory ? 8 : 0);
}

export function schoolForAffinity(affinity: Affinity) {
  return {
    none: null,
    braise: 'BRAISE',
    prisme: 'PRISME',
    neant: 'NÉANT',
  }[affinity] as 'BRAISE' | 'PRISME' | 'NÉANT' | null;
}
