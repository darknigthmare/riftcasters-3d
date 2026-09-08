import {
  CHARACTERS,
  type CharacterId,
  type Difficulty,
  type RunMode,
} from './content';
export type GameSettings = {
  quality: 'low' | 'balanced' | 'high';
  reducedMotion: boolean;
  contrast: boolean;
  autoChannel: boolean;
  autoAim: boolean;
  volume: number;
};
export type RunRecord = {
  character: CharacterId;
  mode: RunMode;
  difficulty: Difficulty;
  score: number;
  kills: number;
  rifts: number;
  cycles: number;
  level: number;
  seconds: number;
  victory: boolean;
  date: string;
};
export type Career = {
  version: 1;
  character: CharacterId;
  mode: RunMode;
  difficulty: Difficulty;
  settings: GameSettings;
  kills: number;
  rifts: number;
  ultimates: number;
  bestCombo: number;
  characterWins: CharacterId[];
  achievements: string[];
  history: RunRecord[];
  bestCycle: number;
};
export const ACHIEVEMENTS = [
  {
    id: 'first-rift',
    title: 'Premier ancrage',
    description: 'Stabiliser une faille.',
    target: 1,
    metric: 'rifts',
  },
  {
    id: 'rift-warden',
    title: 'Gardien des seuils',
    description: 'Stabiliser 25 failles.',
    target: 25,
    metric: 'rifts',
  },
  {
    id: 'hunter',
    title: 'Chasseur d’anomalies',
    description: 'Éliminer 100 anomalies.',
    target: 100,
    metric: 'kills',
  },
  {
    id: 'veteran',
    title: 'La longue veille',
    description: 'Éliminer 1 000 anomalies.',
    target: 1000,
    metric: 'kills',
  },
  {
    id: 'resonance',
    title: 'Résonance parfaite',
    description: 'Atteindre un combo de 9.',
    target: 9,
    metric: 'bestCombo',
  },
  {
    id: 'ultimates',
    title: 'Briseur de trame',
    description: 'Déclencher 20 ultimes.',
    target: 20,
    metric: 'ultimates',
  },
  {
    id: 'kaela',
    title: 'Cœur de braise',
    description: 'Vaincre le Tyran avec Kaela.',
  },
  {
    id: 'orin',
    title: 'Œil de l’orage',
    description: 'Vaincre le Tyran avec Orin.',
  },
  {
    id: 'nyx',
    title: 'Au-delà du vide',
    description: 'Vaincre le Tyran avec Nyx.',
  },
  {
    id: 'elias',
    title: 'La seconde chance',
    description: 'Vaincre le Tyran avec Elias.',
  },
  {
    id: 'convergence',
    title: 'Quatre destinées',
    description: 'Vaincre le Tyran avec les quatre Riftcasters.',
  },
  {
    id: 'endurance',
    title: 'Par-delà la Convergence',
    description: 'Terminer trois cycles en Endurance.',
  },
] as const;
export function defaultCareer(): Career {
  return {
    version: 1,
    character: 'kaela',
    mode: 'expedition',
    difficulty: 'standard',
    settings: {
      quality: 'balanced',
      reducedMotion: false,
      contrast: false,
      autoChannel: false,
      autoAim: false,
      volume: 0.65,
    },
    kills: 0,
    rifts: 0,
    ultimates: 0,
    bestCombo: 0,
    characterWins: [],
    achievements: [],
    history: [],
    bestCycle: 0,
  };
}
const integer = (value: unknown, max = 1e9) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(max, Math.floor(value)))
    : 0;
const character = (value: unknown): value is CharacterId =>
  CHARACTERS.some((entry) => entry.id === value);
export function sanitizeCareer(value: unknown): Career {
  const base = defaultCareer();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
  const raw = value as Partial<Career>;
  const settings = raw.settings ?? base.settings;
  return {
    ...base,
    character: character(raw.character) ? raw.character : base.character,
    mode: raw.mode === 'endless' ? 'endless' : 'expedition',
    difficulty:
      raw.difficulty === 'discovery' || raw.difficulty === 'cataclysm'
        ? raw.difficulty
        : 'standard',
    settings: {
      quality:
        settings.quality === 'low' || settings.quality === 'high'
          ? settings.quality
          : 'balanced',
      reducedMotion: settings.reducedMotion === true,
      contrast: settings.contrast === true,
      autoChannel: settings.autoChannel === true,
      autoAim: settings.autoAim === true,
      volume:
        typeof settings.volume === 'number' && Number.isFinite(settings.volume)
          ? Math.max(0, Math.min(1, settings.volume))
          : 0.65,
    },
    kills: integer(raw.kills),
    rifts: integer(raw.rifts),
    ultimates: integer(raw.ultimates),
    bestCombo: integer(raw.bestCombo, 9),
    bestCycle: integer(raw.bestCycle, 10000),
    characterWins: Array.isArray(raw.characterWins)
      ? [...new Set(raw.characterWins.filter(character))]
      : [],
    achievements: Array.isArray(raw.achievements)
      ? ACHIEVEMENTS.filter((entry) =>
          raw.achievements?.includes(entry.id),
        ).map((entry) => entry.id)
      : [],
    history: Array.isArray(raw.history)
      ? raw.history
          .filter(
            (entry) =>
              entry &&
              character(entry.character) &&
              typeof entry.date === 'string' &&
              Number.isFinite(Date.parse(entry.date)),
          )
          .slice(0, 20)
          .map((entry) => ({
            character: entry.character,
            mode: entry.mode === 'endless' ? 'endless' : 'expedition',
            difficulty:
              entry.difficulty === 'discovery' ||
              entry.difficulty === 'cataclysm'
                ? entry.difficulty
                : 'standard',
            date: entry.date.slice(0, 30),
            score: integer(entry.score),
            kills: integer(entry.kills),
            rifts: integer(entry.rifts),
            cycles: integer(entry.cycles),
            level: integer(entry.level, 10000),
            seconds: integer(entry.seconds),
            victory: entry.victory === true,
          }))
      : [],
  };
}
export function awardAchievements(career: Career): string[] {
  return ACHIEVEMENTS.filter((entry) => {
    if (career.achievements.includes(entry.id)) return false;
    if ('metric' in entry) return career[entry.metric] >= entry.target;
    if (entry.id === 'convergence') return career.characterWins.length === 4;
    if (entry.id === 'endurance') return career.bestCycle >= 3;
    return career.characterWins.some((id) => id === entry.id);
  }).map((entry) => entry.id);
}
