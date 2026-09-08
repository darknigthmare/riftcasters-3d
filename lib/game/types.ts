export type GamePhase =
  | 'menu'
  | 'playing'
  | 'paused'
  | 'upgrade'
  | 'gameover'
  | 'victory'
  | 'camp';

export type EnemyKind =
  | 'stalker'
  | 'spectre'
  | 'guardian'
  | 'leech'
  | 'artillery'
  | 'ravager'
  | 'boss';

export type AbilityId = 'gravity' | 'shield' | 'dash' | 'ultimate';

export type AffinityId = 'braise' | 'prisme' | 'neant';

export type Affinity = 'none' | AffinityId;

export type AffinityUnlocks = Record<AffinityId, boolean>;

export type HudSnapshot = {
  character: import('./content').CharacterId;
  mode: import('./content').RunMode;
  difficulty: import('./content').Difficulty;
  career: import('./career').Career;
  cycle: number;
  level: number;
  experience: number;
  nextLevelExperience: number;
  mana: number;
  maxMana: number;
  kills: number;
  bossPhase: number;
  upgradeReason: 'rift' | 'level';
  newAchievements: string[];
  qaMode: boolean;
  checkpointCycle: number | null;
  storageConflict: boolean;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  score: number;
  wave: number;
  riftProgress: number;
  voidPressure: number;
  riftsStabilized: number;
  enemies: number;
  ultimate: number;
  dashCharges: number;
  gravityCooldown: number;
  shieldCooldown: number;
  elapsed: number;
  highScore: number;
  dust: number;
  runsCompleted: number;
  victories: number;
  affinity: Affinity;
  unlockedAffinities: AffinityUnlocks;
  storageAvailable: boolean;
  upgradeRanks: Partial<Record<UpgradeId, number>>;
  build: BuildEntry[];
  rerollCost: number | null;
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
  | 'echo-burst'
  | 'ember'
  | 'chain'
  | 'stasis'
  | 'void-mark'
  | 'mana-flow'
  | 'soul-siphon'
  | 'convergence';

export type UpgradeChoice = {
  id: UpgradeId;
  school: 'BRAISE' | 'PRISME' | 'NÉANT';
  title: string;
  description: string;
  icon: 'bolt' | 'shield' | 'void' | 'heart' | 'dash';
};

export type BuildEntry = Pick<
  UpgradeChoice,
  'id' | 'school' | 'title' | 'icon'
> & {
  rank: number;
};
