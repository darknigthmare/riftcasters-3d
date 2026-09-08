import { expect, it } from 'vitest';
import {
  sanitizeCheckpoint,
  UPGRADE_IDS,
  type RunCheckpoint,
} from './checkpoint';
const checkpoint: RunCheckpoint = {
  version: 1,
  character: 'nyx',
  difficulty: 'standard',
  cycle: 2,
  score: 10000,
  rifts: 10,
  level: 7,
  experience: 15,
  pendingLevels: 1,
  kills: 45,
  ultimates: 3,
  bestCombo: 9,
  elapsed: 245,
  ranks: { 'vital-surge': 2 },
  rerolls: 1,
};
it('restores a valid camp and preserves XP and build ranks', () => {
  expect(sanitizeCheckpoint(checkpoint)).toEqual(checkpoint);
});
it('rejects partial, inconsistent or non-finite checkpoints', () => {
  expect(sanitizeCheckpoint({})).toBeNull();
  expect(sanitizeCheckpoint({ ...checkpoint, rifts: 5 })).toBeNull();
  expect(sanitizeCheckpoint({ ...checkpoint, score: Infinity })).toBeNull();
  expect(sanitizeCheckpoint({ ...checkpoint, cycle: 0 })).toBeNull();
});
it('restricts upgrade ranks to the fifteen legal choices', () => {
  expect(UPGRADE_IDS).toHaveLength(15);
  expect(
    sanitizeCheckpoint({
      ...checkpoint,
      ranks: { 'arcane-force': 900, 'vital-surge': -3, admin: 99 },
    })?.ranks,
  ).toEqual({ 'arcane-force': 3, 'vital-surge': 0 });
});
