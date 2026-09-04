import { describe, expect, it } from 'vitest';
import {
  affinityUnlockCost,
  calculateDustReward,
  createDefaultProfile,
  readProgression,
  recalibrationCost,
} from './progression';

describe('archive progression', () => {
  it('migrates the v1 score, dust and sound preferences', () => {
    const profile = readProgression(
      null,
      JSON.stringify({ highScore: 4200, dust: 17, muted: true }),
    );
    expect(profile).toMatchObject({
      version: 2,
      highScore: 4200,
      dust: 17,
      muted: true,
      equippedAffinity: 'none',
    });
  });

  it('rejects infinite and negative save values', () => {
    const profile = readProgression(
      JSON.stringify({
        version: 2,
        highScore: 'Infinity',
        dust: -50,
        muted: 'false',
        runsCompleted: 2,
        victories: 99,
        unlockedAffinities: {
          braise: 'false',
          prisme: false,
          neant: false,
        },
        equippedAffinity: 'braise',
      }),
      null,
    );
    expect(profile.highScore).toBe(0);
    expect(profile.dust).toBe(0);
    expect(profile.victories).toBe(2);
    expect(profile.muted).toBe(false);
    expect(profile.unlockedAffinities.braise).toBe(false);
    expect(profile.equippedAffinity).toBe('none');
  });

  it('falls back safely when the save is corrupted', () => {
    expect(readProgression('{broken', null)).toEqual(createDefaultProfile());
  });

  it('ignores an invalid v2 slot and preserves a valid v1 save', () => {
    const legacy = JSON.stringify({ highScore: 7300, dust: 9, muted: true });
    expect(readProgression('{}', legacy)).toMatchObject({
      highScore: 7300,
      dust: 9,
      muted: true,
    });
    expect(readProgression('[]', legacy).highScore).toBe(7300);
    expect(readProgression('{"version":1}', legacy).highScore).toBe(7300);
    expect(readProgression('{"version":2}', legacy).highScore).toBe(7300);
  });

  it('requires a real stabilized rift before awarding dust', () => {
    expect(
      calculateDustReward({
        score: 50_000,
        riftsStabilized: 0,
        victory: false,
      }),
    ).toBe(0);
    expect(
      calculateDustReward({
        score: 8_500,
        riftsStabilized: 3,
        victory: true,
      }),
    ).toBe(24);
    expect(
      calculateDustReward({
        score: 1_000_000,
        riftsStabilized: 1,
        victory: false,
      }),
    ).toBe(12);
  });

  it('uses bounded costs for affinities and recalibrations', () => {
    expect(affinityUnlockCost('braise')).toBe(14);
    expect(affinityUnlockCost('neant')).toBe(18);
    expect(recalibrationCost(0)).toBe(4);
    expect(recalibrationCost(99)).toBe(20);
  });
});
