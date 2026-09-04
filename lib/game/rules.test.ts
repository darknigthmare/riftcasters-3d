import { describe, expect, it } from 'vitest';
import {
  dashRechargeTime,
  nextRiftPosition,
  resolveDamage,
  riftCaptureRate,
  scoreForKill,
  seededShuffle,
  spawnIntervalForWave,
  voidPressureRate,
} from './rules';

describe('combat damage', () => {
  it('absorbs damage with the shield before health', () => {
    expect(resolveDamage(100, 25, 18)).toEqual({
      health: 100,
      shield: 7,
      absorbed: 18,
      healthLost: 0,
    });
  });

  it('carries excess damage through the shield without negative values', () => {
    expect(resolveDamage(12, 5, 30)).toEqual({
      health: 0,
      shield: 0,
      absorbed: 5,
      healthLost: 12,
    });
  });
});

describe('rift pacing', () => {
  it('stops capture outside the channeling zone', () => {
    expect(riftCaptureRate(0, false)).toBe(0);
  });

  it('slows capture when enemies contest the rift', () => {
    expect(riftCaptureRate(4)).toBeLessThan(riftCaptureRate(0));
  });

  it('accelerates deterministic QA spawning', () => {
    expect(spawnIntervalForWave(1, true)).toBeLessThan(spawnIntervalForWave(1));
  });

  it('uses three distinct rift positions before cycling', () => {
    const first = nextRiftPosition(1);
    const second = nextRiftPosition(2);
    const third = nextRiftPosition(3);
    expect(
      new Set([first, second, third].map((value) => JSON.stringify(value)))
        .size,
    ).toBe(3);
    expect(nextRiftPosition(4)).toEqual(first);
  });

  it('turns contesting enemies into pressure while clean channeling relieves it', () => {
    expect(
      voidPressureRate({
        wave: 2,
        nearbyEnemies: 3,
        enemyCount: 8,
        channeling: true,
      }),
    ).toBeGreaterThan(0);
    expect(
      voidPressureRate({
        wave: 2,
        nearbyEnemies: 0,
        enemyCount: 2,
        channeling: true,
      }),
    ).toBeLessThan(0);
  });
});

describe('progression rules', () => {
  it('never reduces dash recharge below the balance floor', () => {
    expect(dashRechargeTime(99)).toBe(2.6);
  });

  it('scores bosses above regular enemies and scales with waves', () => {
    expect(scoreForKill('boss', 1)).toBeGreaterThan(
      scoreForKill('guardian', 3),
    );
    expect(scoreForKill('stalker', 3)).toBeGreaterThan(
      scoreForKill('stalker', 1),
    );
  });

  it('produces stable upgrade orders for a fixed seed', () => {
    const values = ['braise', 'prisme', 'néant', 'vital'];
    expect(seededShuffle(values, 42)).toEqual(seededShuffle(values, 42));
    expect(seededShuffle(values, 42)).toHaveLength(values.length);
  });
});
