export type DamageResolution = {
  health: number;
  shield: number;
  absorbed: number;
  healthLost: number;
};

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function distance2D(
  first: { x: number; z: number },
  second: { x: number; z: number },
) {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

export function resolveDamage(
  health: number,
  shield: number,
  incoming: number,
): DamageResolution {
  const safeIncoming = Math.max(0, incoming);
  const absorbed = Math.min(Math.max(0, shield), safeIncoming);
  const healthLost = Math.min(
    Math.max(0, health),
    Math.max(0, safeIncoming - absorbed),
  );
  return {
    health: Math.max(0, health - healthLost),
    shield: Math.max(0, shield - absorbed),
    absorbed,
    healthLost,
  };
}

export function riftCaptureRate(nearbyEnemies: number, channeling = true) {
  if (!channeling) return 0;
  return 9 / (1 + Math.max(0, nearbyEnemies) * 0.32);
}

export function voidPressureRate({
  wave,
  nearbyEnemies,
  enemyCount,
  channeling,
}: {
  wave: number;
  nearbyEnemies: number;
  enemyCount: number;
  channeling: boolean;
}) {
  const basePressure = 0.16 + Math.max(0, wave - 1) * 0.035;
  const contestPressure = Math.max(0, nearbyEnemies) * 0.58;
  const swarmPressure = Math.max(0, enemyCount - 8) * 0.045;
  const channelingRelief = channeling ? 0.42 : 0;
  return clamp(
    basePressure + contestPressure + swarmPressure - channelingRelief,
    -0.5,
    4.2,
  );
}

export function spawnIntervalForWave(wave: number, qaMode = false) {
  if (qaMode) return 0.72;
  return clamp(2.15 - Math.max(0, wave - 1) * 0.24, 0.82, 2.15);
}

export function dashRechargeTime(upgradeLevel: number) {
  return clamp(5.2 - Math.max(0, upgradeLevel) * 0.75, 2.6, 5.2);
}

export function scoreForKill(
  kind: 'stalker' | 'spectre' | 'guardian' | 'leech' | 'boss',
  wave: number,
) {
  const base = {
    stalker: 100,
    spectre: 135,
    guardian: 220,
    leech: 175,
    boss: 5000,
  }[kind];
  return Math.round(base * (1 + Math.max(0, wave - 1) * 0.18));
}

export function seededShuffle<T>(values: readonly T[], seed: number) {
  const result = [...values];
  let state = Math.max(1, Math.floor(seed)) >>> 0;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const target = state % (index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function nextRiftPosition(wave: number) {
  const positions = [
    { x: 0, z: 0 },
    { x: 4.6, z: -3.2 },
    { x: -4.8, z: 2.4 },
  ];
  return positions[(Math.max(1, wave) - 1) % positions.length];
}
