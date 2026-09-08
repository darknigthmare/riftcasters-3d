import { CHARACTERS, type CharacterId, type Difficulty } from './content';
import type { UpgradeId } from './types';
export const UPGRADE_IDS: UpgradeId[] = [
  'forked-bolt',
  'arcane-force',
  'piercing-light',
  'prism-ward',
  'rift-step',
  'void-well',
  'vital-surge',
  'echo-burst',
  'ember',
  'chain',
  'stasis',
  'void-mark',
  'mana-flow',
  'soul-siphon',
  'convergence',
];
export type RunCheckpoint = {
  version: 1;
  character: CharacterId;
  difficulty: Difficulty;
  cycle: number;
  score: number;
  rifts: number;
  level: number;
  experience: number;
  pendingLevels: number;
  kills: number;
  ultimates: number;
  bestCombo: number;
  elapsed: number;
  ranks: Partial<Record<UpgradeId, number>>;
  rerolls: number;
};
export function sanitizeCheckpoint(value: unknown): RunCheckpoint | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as RunCheckpoint;
  if (
    raw.version !== 1 ||
    !CHARACTERS.some((entry) => entry.id === raw.character) ||
    !['discovery', 'standard', 'cataclysm'].includes(raw.difficulty)
  )
    return null;
  const keys = [
    'cycle',
    'score',
    'rifts',
    'level',
    'experience',
    'pendingLevels',
    'kills',
    'ultimates',
    'bestCombo',
    'elapsed',
    'rerolls',
  ] as const;
  if (
    keys.some(
      (key) => !Number.isFinite(raw[key]) || raw[key] < 0 || raw[key] > 1e9,
    )
  )
    return null;
  if (
    !Number.isInteger(raw.cycle) ||
    raw.cycle < 1 ||
    raw.cycle > 10000 ||
    raw.rifts !== raw.cycle * 5 ||
    raw.level < 1 ||
    raw.level > 10000 ||
    raw.pendingLevels > 10000
  )
    return null;
  const ranks: Partial<Record<UpgradeId, number>> = {};
  for (const id of UPGRADE_IDS) {
    const rank = raw.ranks?.[id];
    if (typeof rank === 'number' && Number.isFinite(rank))
      ranks[id] = Math.max(0, Math.min(3, Math.floor(rank)));
  }
  return {
    version: 1,
    character: raw.character,
    difficulty: raw.difficulty,
    cycle: raw.cycle,
    score: Math.floor(raw.score),
    rifts: raw.rifts,
    level: Math.floor(raw.level),
    experience: Math.floor(raw.experience),
    pendingLevels: Math.floor(raw.pendingLevels),
    kills: Math.floor(raw.kills),
    ultimates: Math.floor(raw.ultimates),
    bestCombo: Math.min(9, Math.floor(raw.bestCombo)),
    elapsed: raw.elapsed,
    ranks,
    rerolls: Math.floor(raw.rerolls),
  };
}
