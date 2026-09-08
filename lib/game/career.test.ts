import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  awardAchievements,
  defaultCareer,
  sanitizeCareer,
} from './career';
import {
  CHARACTERS,
  EXTRA_UPGRADES,
  RIFTS_PER_CYCLE,
  bossPhaseAt,
  experienceForLevel,
  isBossWave,
} from './content';
import { createDefaultProfile, readProgression } from './progression';

describe('Convergence content contract', () => {
  it('defines four distinct disciplines and seven additional upgrades', () => {
    expect(CHARACTERS).toHaveLength(4);
    expect(new Set(CHARACTERS.map((entry) => entry.discipline)).size).toBe(4);
    expect(new Set(EXTRA_UPGRADES.map((entry) => entry.id)).size).toBe(7);
    expect(RIFTS_PER_CYCLE).toBe(5);
    for (let wave = 1; wave <= 5; wave++) expect(isBossWave(wave)).toBe(false);
    expect(isBossWave(6)).toBe(true);
  });
  it('has strictly increasing finite XP requirements', () => {
    for (let level = 1; level < 1000; level++)
      expect(experienceForLevel(level + 1)).toBeGreaterThan(
        experienceForLevel(level),
      );
  });
  it('never reverses a boss phase after healing', () => {
    expect(bossPhaseAt(0.9, 2)).toBe(2);
    expect(bossPhaseAt(0.2, 1)).toBe(3);
    expect(bossPhaseAt(1, 3)).toBe(3);
  });
});
describe('career persistence', () => {
  it('migrates an existing v2 save without losing its currency or affinity', () => {
    const previous = {
      ...createDefaultProfile(),
      highScore: 12450,
      dust: 55,
      runsCompleted: 4,
      victories: 2,
      unlockedAffinities: { braise: true, prisme: false, neant: false },
      equippedAffinity: 'braise',
    };
    delete (previous as { career?: unknown }).career;
    const result = readProgression(JSON.stringify(previous), null);
    expect(result.highScore).toBe(12450);
    expect(result.dust).toBe(55);
    expect(result.equippedAffinity).toBe('braise');
    expect(result.career).toEqual(defaultCareer());
  });
  it('sanitizes hostile and malformed career fields', () => {
    const result = sanitizeCareer({
      character: 'admin',
      kills: Infinity,
      settings: { volume: -100, quality: 'ultra' },
      achievements: ['unknown', 'hunter', 'hunter'],
      characterWins: ['nyx', 'nyx', 'fake'],
      history: [null, {}, { character: 'kaela', date: 'invalid' }],
    });
    expect(result.character).toBe('kaela');
    expect(result.kills).toBe(0);
    expect(result.settings.volume).toBe(0);
    expect(result.settings.quality).toBe('balanced');
    expect(result.achievements).toEqual(['hunter']);
    expect(result.characterWins).toEqual(['nyx']);
    expect(result.history).toEqual([]);
    expect(sanitizeCareer(null)).toEqual(defaultCareer());
    expect(sanitizeCareer([])).toEqual(defaultCareer());
  });
  it('awards exactly twelve achievements once when every condition is met', () => {
    const career = {
      ...defaultCareer(),
      kills: 1000,
      rifts: 25,
      ultimates: 20,
      bestCombo: 9,
      bestCycle: 3,
      characterWins: CHARACTERS.map((entry) => entry.id),
    };
    const awarded = awardAchievements(career);
    expect(awarded).toHaveLength(12);
    expect(new Set(awarded).size).toBe(ACHIEVEMENTS.length);
    career.achievements = awarded;
    expect(awardAchievements(career)).toEqual([]);
  });
  it('does not award a victory or endurance for an empty career', () => {
    expect(awardAchievements(defaultCareer())).toEqual([]);
  });
});
