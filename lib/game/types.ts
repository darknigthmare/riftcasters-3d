export type GamePhase =
  | 'menu'
  | 'playing'
  | 'paused'
  | 'upgrade'
  | 'gameover'
  | 'victory';

export type EnemyKind = 'stalker' | 'spectre' | 'guardian' | 'leech' | 'boss';

export type AbilityId = 'gravity' | 'shield' | 'dash' | 'ultimate';

export type HudSnapshot = {
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  score: number;
  wave: number;
  riftProgress: number;
  enemies: number;
  ultimate: number;
  dashCharges: number;
  gravityCooldown: number;
  shieldCooldown: number;
  elapsed: number;
  highScore: number;
  dust: number;
  combo: number;
  bossHealth: number | null;
  message: string;
};

export type UpgradeId =
  | 'forked-bolt'
  | 'arcane-force'
  | 'piercing-light'
  | 'prism-ward'
  | 'rift-step'
  | 'void-well'
  | 'vital-surge'
  | 'echo-burst';

export type UpgradeChoice = {
  id: UpgradeId;
  school: 'BRAISE' | 'PRISME' | 'NÉANT';
  title: string;
  description: string;
  icon: 'bolt' | 'shield' | 'void' | 'heart' | 'dash';
};
