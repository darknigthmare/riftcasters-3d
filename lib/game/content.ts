import type { UpgradeChoice } from './types';

export type CharacterId = 'kaela' | 'orin' | 'nyx' | 'elias';
export type RunMode = 'expedition' | 'endless';
export type Difficulty = 'discovery' | 'standard' | 'cataclysm';
export const RIFTS_PER_CYCLE = 5;
export const CHARACTERS = [
  {
    id: 'kaela',
    name: 'Kaela Voss',
    discipline: 'Pyromancie',
    color: '#ff9860',
    hex: 0xff9860,
    health: 110,
    damage: 25,
    speed: 5.1,
    secondary: 'BRASIER',
    ultimate: 'SUPERNOVA',
    description:
      'Ses traits embrasent les anomalies. Son brasier persiste au sol ; sa supernova propage la brûlure.',
    lore: 'Gardienne des forges de l’Arche, Kaela transforme les fragments des mondes perdus en une dernière ligne de feu.',
  },
  {
    id: 'orin',
    name: 'Orin Vale',
    discipline: 'Foudre',
    color: '#75eaff',
    hex: 0x75eaff,
    health: 95,
    damage: 21,
    speed: 5.5,
    secondary: 'FULGURANCE',
    ultimate: 'TEMPÊTE',
    description:
      'Ses traits chaînent entre les cibles proches. Fulgurance explose autour du point visé ; sa tempête brise les essaims.',
    lore: 'Navigateur des courants dimensionnels, Orin entend les orages avant que les failles ne s’ouvrent.',
  },
  {
    id: 'nyx',
    name: 'Nyx Seraph',
    discipline: 'Vide',
    color: '#c094ff',
    hex: 0xc094ff,
    health: 100,
    damage: 24,
    speed: 5.2,
    secondary: 'SINGULARITÉ',
    ultimate: 'EFFONDREMENT',
    description:
      'Trois marques du vide déclenchent une rupture. Sa singularité attire les ennemis ; son ultime les rassemble.',
    lore: 'Revenue d’une faille que personne ne croyait franchissable, Nyx utilise le Néant contre sa propre armée.',
  },
  {
    id: 'elias',
    name: 'Elias Quill',
    discipline: 'Chronomancie',
    color: '#9df2b0',
    hex: 0x9df2b0,
    health: 90,
    damage: 22,
    speed: 5.7,
    secondary: 'STASE',
    ultimate: 'RÉMANENCE',
    description:
      'Ses traits ralentissent les cibles. La stase fige une zone ; Rémanence restaure son intégrité et suspend les ennemis.',
    lore: 'Archiviste des futurs effacés, Elias ne peut sauver tous les possibles. Il a choisi celui de l’Arche.',
  },
] as const;
export const DIFFICULTIES = {
  discovery: { label: 'Découverte', health: 0.75, damage: 0.65, pressure: 0.7 },
  standard: { label: 'Standard', health: 1, damage: 1, pressure: 1 },
  cataclysm: { label: 'Cataclysme', health: 1.3, damage: 1.3, pressure: 1.2 },
} as const;
export const RIFT_CHAPTERS = [
  {
    name: 'Le Seuil',
    text: 'Reste dans le cercle et maintiens E pour refermer la première brèche.',
  },
  {
    name: 'Les Forges muettes',
    text: 'Les Gardiens sont résistants mais lents. Garde tes distances ou rassemble-les avec ton arcane.',
  },
  {
    name: 'Le Jardin inversé',
    text: 'Les Sangsues dévorent la stabilisation. Élimine-les avant que la pression ne s’emballe.',
  },
  {
    name: 'Le Chœur brisé',
    text: 'Les Artilleurs marquent le sol. Quitte leurs cercles avant la détonation.',
  },
  {
    name: 'La Dernière heure',
    text: 'Les Ravageurs chargent après un signal rouge. Esquive de côté ; le Tyran attend.',
  },
] as const;
export const EXTRA_UPGRADES: UpgradeChoice[] = [
  {
    id: 'ember',
    school: 'BRAISE',
    title: 'Combustion',
    description:
      'Traits : brûlure pendant 3 s. Dégâts de brûlure renforcés par rang.',
    icon: 'bolt',
  },
  {
    id: 'chain',
    school: 'BRAISE',
    title: 'Arc conducteur',
    description:
      'Chaque impact transmet 35 % des dégâts à une cible voisine supplémentaire par rang.',
    icon: 'bolt',
  },
  {
    id: 'stasis',
    school: 'PRISME',
    title: 'Sablier fracturé',
    description:
      'Les traits ralentissent les anomalies. Chaque rang prolonge la suspension.',
    icon: 'dash',
  },
  {
    id: 'void-mark',
    school: 'NÉANT',
    title: 'Sceau du vide',
    description:
      'Tous les trois impacts, une marque explose. +35 % dégâts de rupture par rang.',
    icon: 'void',
  },
  {
    id: 'mana-flow',
    school: 'PRISME',
    title: 'Flux arcanique',
    description: '+25 mana max et +1,5 mana/s. Recharge le mana immédiatement.',
    icon: 'shield',
  },
  {
    id: 'soul-siphon',
    school: 'NÉANT',
    title: 'Moisson d’âmes',
    description:
      'Éliminations : +1 intégrité par rang. Attraction des objets élargie.',
    icon: 'heart',
  },
  {
    id: 'convergence',
    school: 'NÉANT',
    title: 'Convergence',
    description:
      'Ultime : +25 % dégâts et +2 charge par élimination, par rang.',
    icon: 'void',
  },
];
export function characterById(id: CharacterId) {
  return CHARACTERS.find((entry) => entry.id === id) ?? CHARACTERS[0];
}
export function isBossWave(wave: number) {
  return wave > RIFTS_PER_CYCLE;
}
export function experienceForLevel(level: number) {
  return 45 + Math.max(0, level - 1) * 25;
}
export function bossPhaseAt(healthRatio: number, current = 1) {
  return Math.max(
    current,
    healthRatio <= 0.33 ? 3 : healthRatio <= 0.66 ? 2 : 1,
  );
}
