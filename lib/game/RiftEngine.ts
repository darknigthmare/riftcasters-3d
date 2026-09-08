import * as THREE from 'three';
import {
  clamp,
  dashRechargeTime,
  distance2D,
  nextRiftPosition,
  resolveDamage,
  riftCaptureRate,
  scoreForKill,
  seededShuffle,
  spawnIntervalForWave,
  voidPressureRate,
} from './rules';
import {
  affinityUnlockCost,
  calculateDustReward,
  createDefaultProfile,
  isValidCurrentProgression,
  LEGACY_STORAGE_KEY,
  PROGRESSION_STORAGE_KEY,
  readProgression,
  recalibrationCost,
  schoolForAffinity,
} from './progression';
import type {
  AbilityId,
  Affinity,
  AffinityUnlocks,
  EnemyKind,
  GamePhase,
  HudSnapshot,
  UpgradeChoice,
  UpgradeId,
} from './types';
import { RiftAudio } from './RiftAudio';
import {
  CHARACTERS,
  DIFFICULTIES,
  EXTRA_UPGRADES,
  RIFT_CHAPTERS,
  bossPhaseAt,
  characterById,
  experienceForLevel,
  isBossWave,
  type CharacterId,
  type Difficulty,
  type RunMode,
} from './content';
import {
  awardAchievements,
  defaultCareer,
  sanitizeCareer,
  type GameSettings,
} from './career';
import { sanitizeCheckpoint, type RunCheckpoint } from './checkpoint';

declare global {
  interface Window {
    __riftTest?: {
      state: () => unknown;
      command: (command: string, value?: number) => void;
    };
  }
}

type Callbacks = {
  onHud: (snapshot: HudSnapshot) => void;
  onPhase: (phase: GamePhase) => void;
  onUpgrade: (choices: UpgradeChoice[]) => void;
};

type Enemy = {
  elite: boolean;
  bossPhase: number;
  burn: number;
  burnPower: number;
  slow: number;
  freeze: number;
  marks: number;
  charge: number;
  chargeDirection: THREE.Vector3;
  id: number;
  kind: EnemyKind;
  group: THREE.Group;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  damage: number;
  attackTimer: number;
  shootTimer: number;
  healTimer: number;
  flashTimer: number;
  orbit: number;
};

type Projectile = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  radius: number;
  damage: number;
  hostile: boolean;
  pierce: number;
  hitIds: Set<number>;
};

type AreaEffect = {
  kind: 'gravity' | 'flame' | 'stasis' | 'blast' | 'danger';
  mesh: THREE.Mesh;
  life: number;
  duration: number;
  radius: number;
  damage: number;
  tick: number;
};

type Particle = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  duration: number;
};

type Stats = {
  boltDamage: number;
  boltCount: number;
  fireRate: number;
  pierce: number;
  maxHealth: number;
  shieldPower: number;
  gravityPower: number;
  gravityCooldownScale: number;
  dashLevel: number;
  dashBlast: number;
};

const UPGRADE_LIBRARY: UpgradeChoice[] = [
  ...EXTRA_UPGRADES,
  {
    id: 'forked-bolt',
    school: 'BRAISE',
    title: 'Trait bifurqué',
    description: '+1 projectile arcanique par salve.',
    icon: 'bolt',
  },
  {
    id: 'arcane-force',
    school: 'BRAISE',
    title: 'Cœur incandescent',
    description: '+32 % dégâts et cadence accélérée.',
    icon: 'bolt',
  },
  {
    id: 'piercing-light',
    school: 'BRAISE',
    title: 'Lumière perforante',
    description: 'Les traits traversent une cible supplémentaire.',
    icon: 'bolt',
  },
  {
    id: 'prism-ward',
    school: 'PRISME',
    title: 'Égide prismatique',
    description: 'Bouclier renforcé et soin immédiat.',
    icon: 'shield',
  },
  {
    id: 'rift-step',
    school: 'PRISME',
    title: 'Pas rémanent',
    description: 'Esquive rechargée plus vite et onde à l’arrivée.',
    icon: 'dash',
  },
  {
    id: 'void-well',
    school: 'NÉANT',
    title: 'Singularité avide',
    description: 'Puits plus vaste, plus puissant et plus fréquent.',
    icon: 'void',
  },
  {
    id: 'vital-surge',
    school: 'PRISME',
    title: 'Trame vitale',
    description: '+30 intégrité maximum et restauration complète.',
    icon: 'heart',
  },
  {
    id: 'echo-burst',
    school: 'NÉANT',
    title: 'Écho de rupture',
    description: 'Chaque esquive déclenche une onde destructrice.',
    icon: 'void',
  },
];

const ENEMY_COLORS: Record<EnemyKind, [number, number]> = {
  stalker: [0xff3f88, 0x79173f],
  spectre: [0x60d8ff, 0x194a87],
  guardian: [0xffbd5c, 0x6f3f16],
  leech: [0x9bff83, 0x286942],
  artillery: [0xff784e, 0x6a2210],
  ravager: [0xf4df8b, 0x70601e],
  boss: [0xf05bff, 0x5f0a7c],
};

export class RiftEngine {
  private canvas: HTMLCanvasElement;
  private callbacks: Callbacks;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  private lastFrameTime = performance.now() / 1000;
  private visualElapsed = 0;
  private resizeObserver: ResizeObserver;
  private animationFrame = 0;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private aimPoint = new THREE.Vector3(0, 0, -2);
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private keys = new Set<string>();
  private player = new THREE.Group();
  private playerFocus!: THREE.Mesh;
  private playerRing!: THREE.Mesh;
  private shieldMesh!: THREE.Mesh;
  private aimMarker!: THREE.Mesh;
  private rift = new THREE.Group();
  private riftCore!: THREE.Mesh;
  private riftField!: THREE.Mesh;
  private riftLight!: THREE.PointLight;
  private enemyRoot = new THREE.Group();
  private projectileRoot = new THREE.Group();
  private effectRoot = new THREE.Group();
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private areas: AreaEffect[] = [];
  private particles: Particle[] = [];
  private phase: GamePhase = 'menu';
  private qaMode = false;
  private wave = 1;
  private riftProgress = 0;
  private voidPressure = 0;
  private riftsStabilized = 0;
  private voidWarningTier = 0;
  private riftTarget = new THREE.Vector3();
  private health = 100;
  private shield = 0;
  private score = 0;
  private highScore = 0;
  private dust = 0;
  private runsCompleted = 0;
  private victories = 0;
  private unlockedAffinities: AffinityUnlocks = {
    braise: false,
    prisme: false,
    neant: false,
  };
  private affinity: Affinity = 'none';
  private storageAvailable = true;
  private ultimate = 0;
  private combo = 0;
  private comboTimer = 0;
  private elapsed = 0;
  private spawnTimer = 0;
  private shotTimer = 0;
  private gravityCooldown = 0;
  private shieldCooldown = 0;
  private shieldTime = 0;
  private dashCharges = 2;
  private dashRecharge = 0;
  private invulnerable = 0;
  private bossSpawned = false;
  private nextEnemyId = 1;
  private message = 'Entre dans la faille';
  private messageTimer = 0;
  private mouseHeld = false;
  private touchMove = new THREE.Vector2();
  private touchAttack = false;
  private lastHudPush = 0;
  private shake = 0;
  private reducedMotion = false;
  private muted = false;
  private audio = new RiftAudio();
  private upgradeRanks = new Map<UpgradeId, number>();
  private currentUpgradeChoices: UpgradeChoice[] = [];
  private rerollsThisRun = 0;
  private lastRerollAt = -Infinity;
  private gamepadButtons = new Map<number, boolean>();
  private gamepadNeedsRelease = false;
  private stats: Stats = this.defaultStats();
  private career = defaultCareer();
  private checkpoint: RunCheckpoint | null = null;
  private lastSavedRaw: string | null = null;
  private storageConflict = false;
  private cycle = 1;
  private completedCycles = 0;
  private level = 1;
  private experience = 0;
  private pendingLevels = 0;
  private upgradeReason: 'rift' | 'level' = 'rift';
  private mana = 100;
  private kills = 0;
  private runUltimates = 0;
  private bestCombo = 0;
  private newAchievements: string[] = [];
  private touchChannel = false;
  private pickups: Array<{
    mesh: THREE.Mesh;
    kind: 'health' | 'mana' | 'essence';
    life: number;
  }> = [];

  constructor(canvas: HTMLCanvasElement, callbacks: Callbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.qaMode = new URLSearchParams(window.location.search).get('qa') === '1';
    this.reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    this.loadSave();
    this.stats = this.defaultStats();
    this.health = this.stats.maxHealth;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, this.qaMode ? 1.25 : 1.7),
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene.background = new THREE.Color(0x02030a);
    this.scene.fog = new THREE.FogExp2(0x040510, 0.028);
    this.camera.position.set(10.5, 14.5, 13);
    this.camera.lookAt(0, 0, 0);

    this.buildWorld();
    this.applySettings();
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(canvas);
    this.resize();
    this.bindEvents();
    this.loop();
    this.pushHud(true);
    if (this.qaMode)
      window.__riftTest = {
        state: () => ({
          phase: this.phase,
          wave: this.wave,
          cycle: this.cycle,
          level: this.level,
          experience: this.experience,
          mana: this.mana,
          health: this.health,
          rifts: this.riftsStabilized,
          kills: this.kills,
          player: this.player.position.toArray(),
          target: this.riftTarget.toArray(),
          enemies: this.enemies.map((enemy) => ({
            kind: enemy.kind,
            hp: enemy.hp,
            phase: enemy.bossPhase,
            burn: enemy.burn,
            burnPower: enemy.burnPower,
            freeze: enemy.freeze,
            marks: enemy.marks,
            slow: enemy.slow,
            elite: enemy.elite,
          })),
          upgrades: [...this.upgradeRanks],
          choices: this.currentUpgradeChoices.map((entry) => entry.id),
          reason: this.upgradeReason,
          gpu: this.renderer.info.memory,
          calls: this.renderer.info.render.calls,
        }),
        command: (command, value = 1) => {
          if (!this.qaMode) return;
          if (command === 'step')
            for (let i = 0; i < Math.min(3000, Math.max(0, value)); i += 1) {
              if (this.phase === 'playing') this.updateGame(1 / 60);
            }
          if (
            command === 'rift' &&
            this.phase === 'playing' &&
            !isBossWave(this.wave)
          ) {
            this.player.position.copy(this.riftTarget);
            this.riftProgress = 99.99;
            this.updateWave(0.04);
          }
          if (command === 'xp' && this.phase === 'playing') {
            this.gainExperience(Math.max(0, Math.min(5000, value)));
            this.updateGame(0);
          }
          if (command === 'damage') this.damagePlayer(Math.max(0, value));
          if (command === 'boss-health') {
            const boss = this.enemies.find((entry) => entry.kind === 'boss');
            if (boss) {
              boss.hp = boss.maxHp * clamp(value, 0.01, 1);
              this.updateEnemies(0);
            }
          }
          if (command === 'kill-boss') {
            const boss = this.enemies.find((entry) => entry.kind === 'boss');
            if (boss)
              this.damageEnemy(boss, boss.maxHp * 2, boss.group.position);
          }
          if (command === 'max-build')
            UPGRADE_LIBRARY.forEach((entry) =>
              this.upgradeRanks.set(entry.id, 3),
            );
          if (command === 'ultimate') this.ultimate = 100;
          if (command === 'effect-fixture' && this.phase === 'playing') {
            this.clearEntities();
            // Keep capture out of range so effect-duration tests cannot pause at a reward screen.
            this.riftTarget.set(0, 0, -9);
            this.player.position.set(0, 0, 0);
            this.aimPoint.set(1, 0, 0);
            this.spawnTimer = 3600;
            this.invulnerable = 60;
            this.spawnEnemy('guardian', new THREE.Vector3(1, 0, 0));
            this.spawnEnemy('guardian', new THREE.Vector3(2, 0, 0));
            this.enemies.forEach((enemy) => {
              enemy.hp = enemy.maxHp = 10000;
              enemy.speed = 0;
            });
          }
          if (command === 'elemental-impact' && this.enemies[0])
            this.applyElementalImpact(this.enemies[0], 100);
          this.pushHud(true);
        },
      };
  }

  private defaultStats(): Stats {
    return {
      boltDamage: 24,
      boltCount: 1,
      fireRate: 0.24,
      pierce: 0,
      maxHealth: 100,
      shieldPower: 38,
      gravityPower: 1,
      gravityCooldownScale: 1,
      dashLevel: 0,
      dashBlast: 0,
    };
  }

  private buildWorld() {
    this.scene.add(new THREE.HemisphereLight(0x799aff, 0x07040f, 1.65));
    const keyLight = new THREE.DirectionalLight(0xb7e6ff, 3.4);
    keyLight.position.set(-7, 12, 8);
    this.scene.add(keyLight);

    const arena = new THREE.Mesh(
      new THREE.CylinderGeometry(10.8, 11.7, 0.85, 64),
      new THREE.MeshStandardMaterial({
        color: 0x0e1427,
        metalness: 0.82,
        roughness: 0.43,
      }),
    );
    arena.position.y = -0.63;
    this.scene.add(arena);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(10.72, 0.13, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0x347cff }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.16;
    this.scene.add(rim);

    const grid = new THREE.GridHelper(20, 24, 0x5230c8, 0x1c2857);
    grid.position.y = -0.17;
    const gridMaterials = Array.isArray(grid.material)
      ? grid.material
      : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.34;
    });
    this.scene.add(grid);

    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2;
      const height = 1.4 + (index % 4) * 0.32;
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.29, height, 5),
        new THREE.MeshStandardMaterial({
          color: 0x17213f,
          emissive: index % 3 === 0 ? 0x392388 : 0x0d234a,
          emissiveIntensity: 0.82,
          metalness: 0.7,
          roughness: 0.38,
        }),
      );
      pillar.position.set(
        Math.cos(angle) * 9.65,
        height / 2 - 0.12,
        Math.sin(angle) * 9.65,
      );
      pillar.rotation.y = -angle;
      this.scene.add(pillar);
    }

    this.buildRift();
    this.buildPlayer();
    this.scene.add(this.enemyRoot, this.projectileRoot, this.effectRoot);
  }

  private buildRift() {
    this.riftCore = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.86, 0.13, 88, 10, 2, 3),
      new THREE.MeshStandardMaterial({
        color: 0x100424,
        emissive: 0xac32ff,
        emissiveIntensity: 4.5,
        metalness: 0.32,
        roughness: 0.14,
      }),
    );
    this.riftCore.scale.y = 1.55;
    this.rift.add(this.riftCore);

    this.riftField = new THREE.Mesh(
      new THREE.RingGeometry(2.85, 2.96, 72),
      new THREE.MeshBasicMaterial({
        color: 0x5fe9ff,
        transparent: true,
        opacity: 0.46,
        side: THREE.DoubleSide,
      }),
    );
    this.riftField.rotation.x = -Math.PI / 2;
    this.riftField.position.y = -1.28;
    this.rift.add(this.riftField);

    for (let index = 0; index < 9; index += 1) {
      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.13 + (index % 3) * 0.05),
        new THREE.MeshStandardMaterial({
          color: index % 2 ? 0x69e9ff : 0xd96bff,
          emissive: index % 2 ? 0x168dff : 0x8a21ff,
          emissiveIntensity: 2.6,
        }),
      );
      const angle = (index / 9) * Math.PI * 2;
      shard.position.set(
        Math.cos(angle) * 1.48,
        Math.sin(angle * 2) * 0.36,
        Math.sin(angle) * 1.48,
      );
      shard.userData.phase = angle;
      this.rift.add(shard);
    }

    this.rift.position.y = 1.28;
    this.riftLight = new THREE.PointLight(0xc759ff, 27, 18, 1.8);
    this.riftLight.position.set(0, 2.15, 0);
    this.scene.add(this.rift, this.riftLight);
  }

  private buildPlayer() {
    const mantle = new THREE.Mesh(
      new THREE.ConeGeometry(0.46, 1.15, 7),
      new THREE.MeshStandardMaterial({
        color: 0x102b57,
        emissive: 0x153d82,
        emissiveIntensity: 0.9,
        metalness: 0.4,
        roughness: 0.5,
      }),
    );
    mantle.position.y = 0.58;
    this.player.add(mantle);

    this.playerFocus = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.27, 1),
      new THREE.MeshStandardMaterial({
        color: 0xd6fbff,
        emissive: 0x38ccff,
        emissiveIntensity: 3.3,
      }),
    );
    this.playerFocus.position.set(0, 1.23, 0);
    this.player.add(this.playerFocus);

    this.playerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.045, 8, 40),
      new THREE.MeshBasicMaterial({
        color: 0x75eaff,
        transparent: true,
        opacity: 0.82,
      }),
    );
    this.playerRing.rotation.x = Math.PI / 2;
    this.playerRing.position.y = 0.04;
    this.player.add(this.playerRing);

    this.shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.92, 20, 14),
      new THREE.MeshBasicMaterial({
        color: 0x7beaff,
        transparent: true,
        opacity: 0.18,
        wireframe: true,
      }),
    );
    this.shieldMesh.position.y = 0.68;
    this.shieldMesh.visible = false;
    this.player.add(this.shieldMesh);
    this.player.position.set(0, 0, 5.2);
    this.scene.add(this.player);

    this.aimMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.29, 24),
      new THREE.MeshBasicMaterial({
        color: 0xb7f7ff,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      }),
    );
    this.aimMarker.rotation.x = -Math.PI / 2;
    this.aimMarker.position.set(0, 0.02, 1);
    this.scene.add(this.aimMarker);
  }

  start() {
    void this.audio.unlock();
    if (this.phase === 'menu' && this.checkpoint) {
      this.resumeCheckpoint();
      return;
    }
    this.resetRun();
    this.setPhase('playing');
    this.showMessage(
      `${RIFT_CHAPTERS[0].name.toUpperCase()} // MAINTIENS E DANS LE CERCLE`,
      4,
    );
  }

  configureRun(character: CharacterId, mode: RunMode, difficulty: Difficulty) {
    if (this.phase !== 'menu' || this.checkpoint) return;
    this.career = sanitizeCareer({
      ...this.career,
      character,
      mode,
      difficulty,
    });
    this.saveProgress();
    this.applyCharacter();
    this.pushHud(true);
  }

  updateSettings(settings: Partial<GameSettings>) {
    this.career = sanitizeCareer({
      ...this.career,
      settings: { ...this.career.settings, ...settings },
    });
    this.applySettings();
    this.saveProgress();
    this.pushHud(true);
  }

  private applySettings() {
    this.reducedMotion =
      this.career.settings.reducedMotion ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        { low: 1, balanced: 1.5, high: 2 }[this.career.settings.quality],
      ),
    );
    this.audio.setVolume(this.career.settings.volume);
    this.applyCharacter();
  }

  private applyCharacter() {
    const caster = characterById(this.career.character);
    if (this.playerFocus)
      (this.playerFocus.material as THREE.MeshStandardMaterial).emissive.setHex(
        caster.hex,
      );
    if (this.playerRing)
      (this.playerRing.material as THREE.MeshBasicMaterial).color.setHex(
        caster.hex,
      );
  }

  private rank(id: UpgradeId) {
    return this.upgradeRanks.get(id) ?? 0;
  }
  private get maxMana() {
    return 100 + 25 * this.rank('mana-flow');
  }
  private get threat() {
    return Math.min(5, 1 + (this.cycle - 1) * 0.35);
  }

  setChannel(active: boolean) {
    this.touchChannel = active;
  }

  continueEndurance() {
    if (this.phase !== 'camp') return;
    this.clearEntities();
    this.cycle += 1;
    this.wave = 1;
    this.bossSpawned = false;
    this.riftProgress = 0;
    this.voidPressure = 0;
    this.health = this.stats.maxHealth;
    this.mana = this.maxMana;
    this.shield = 0;
    this.ultimate = 100;
    this.dashCharges = 2;
    this.dashRecharge = 0;
    this.gravityCooldown = 0;
    this.shieldCooldown = 0;
    this.shieldTime = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.spawnTimer = 1.5;
    this.invulnerable = 2;
    this.moveRiftToWave();
    this.setPhase('playing');
    this.showMessage(`CYCLE ${this.cycle} // LA CONVERGENCE RECOMMENCE`, 3);
  }

  extractRun() {
    if (this.phase !== 'camp') return;
    this.setPhase('playing');
    this.finishRun(true);
  }

  private resumeCheckpoint() {
    const saved = this.checkpoint;
    if (!saved) return;
    this.career.character = saved.character;
    this.career.difficulty = saved.difficulty;
    this.career.mode = 'endless';
    this.resetRun();
    for (const [id, rank] of Object.entries(saved.ranks))
      this.upgradeRanks.set(id as UpgradeId, rank);
    const rank = (id: UpgradeId) => this.rank(id);
    const caster = characterById(saved.character);
    this.stats = {
      boltDamage: caster.damage * 1.32 ** rank('arcane-force'),
      boltCount: Math.min(5, 1 + rank('forked-bolt')),
      fireRate: Math.max(0.12, 0.24 * 0.91 ** rank('arcane-force')),
      pierce: rank('piercing-light'),
      maxHealth: caster.health + 30 * rank('vital-surge'),
      shieldPower: 38 + 18 * rank('prism-ward'),
      gravityPower: 1 + 0.34 * rank('void-well'),
      gravityCooldownScale: 0.86 ** rank('void-well'),
      dashLevel: rank('rift-step'),
      dashBlast: 18 * rank('rift-step') + 34 * rank('echo-burst'),
    };
    this.health = this.stats.maxHealth;
    this.mana = this.maxMana;
    this.cycle = saved.cycle;
    this.completedCycles = saved.cycle;
    this.wave = 6;
    this.score = saved.score;
    this.riftsStabilized = saved.rifts;
    this.level = saved.level;
    this.experience = saved.experience;
    this.pendingLevels = saved.pendingLevels;
    this.kills = saved.kills;
    this.runUltimates = saved.ultimates;
    this.bestCombo = saved.bestCombo;
    this.elapsed = saved.elapsed;
    this.rerollsThisRun = saved.rerolls;
    this.setPhase('camp');
  }

  private saveCheckpoint() {
    if (this.qaMode) return;
    this.checkpoint = {
      version: 1,
      character: this.career.character,
      difficulty: this.career.difficulty,
      cycle: this.cycle,
      score: this.score,
      rifts: this.riftsStabilized,
      level: this.level,
      experience: this.experience,
      pendingLevels: this.pendingLevels,
      kills: this.kills,
      ultimates: this.runUltimates,
      bestCombo: this.bestCombo,
      elapsed: this.elapsed,
      ranks: Object.fromEntries(this.upgradeRanks),
      rerolls: this.rerollsThisRun,
    };
    this.saveProgress();
  }

  abandonRun() {
    if (this.phase !== 'paused') return;
    this.setPhase('playing');
    this.finishRun(false);
  }

  exportSave() {
    return JSON.stringify(
      {
        ...createDefaultProfile(),
        highScore: this.highScore,
        dust: this.dust,
        muted: this.muted,
        runsCompleted: this.runsCompleted,
        victories: this.victories,
        unlockedAffinities: this.unlockedAffinities,
        equippedAffinity: this.affinity,
        career: this.career,
        checkpoint: this.checkpoint,
      },
      null,
      2,
    );
  }

  importSave(raw: string) {
    if (
      this.phase !== 'menu' ||
      this.qaMode ||
      this.storageConflict ||
      raw.length > 100000 ||
      !isValidCurrentProgression(raw)
    )
      return false;
    try {
      const requestedCheckpoint: unknown = (
        JSON.parse(raw) as { checkpoint?: unknown }
      ).checkpoint;
      if (
        requestedCheckpoint != null &&
        !sanitizeCheckpoint(requestedCheckpoint)
      )
        return false;
      if (
        window.localStorage.getItem(PROGRESSION_STORAGE_KEY) !==
        this.lastSavedRaw
      ) {
        this.markStorageConflict();
        return false;
      }
      const clean = readProgression(raw, null);
      window.localStorage.setItem('riftcasters-save-backup', this.exportSave());
      window.localStorage.setItem(
        PROGRESSION_STORAGE_KEY,
        JSON.stringify(clean),
      );
      this.loadSave();
      this.applySettings();
      this.pushHud(true);
      return true;
    } catch {
      return false;
    }
  }

  retrySave() {
    const success = this.saveProgress();
    this.pushHud(true);
    return success;
  }

  private markStorageConflict() {
    this.storageConflict = true;
    this.storageAvailable = false;
    if (this.phase === 'playing') this.setPhase('paused');
    this.pushHud(true);
  }

  private onStorage = (event: StorageEvent) => {
    if (
      (event.key === PROGRESSION_STORAGE_KEY || event.key === null) &&
      event.newValue !== this.lastSavedRaw
    )
      this.markStorageConflict();
  };

  returnToMenu() {
    if (this.phase !== 'gameover' && this.phase !== 'victory') return;
    this.resetRun();
    this.ultimate = 0;
    this.messageTimer = 0;
    this.message = 'Entre dans la faille';
    this.setPhase('menu');
  }

  setAffinity(affinity: Affinity) {
    if (this.phase !== 'menu') {
      return {
        success: false,
        reason: 'L’affinité ne peut être modifiée que depuis l’Arche.',
        ...this.getProgression(),
      };
    }
    if (affinity === 'none') {
      const previousAffinity = this.affinity;
      this.affinity = 'none';
      if (!this.saveProgress()) {
        this.affinity = previousAffinity;
        this.pushHud(true);
        return {
          success: false,
          reason: 'Sauvegarde indisponible : affinité inchangée.',
          ...this.getProgression(),
        };
      }
      this.pushHud(true);
      return {
        success: true,
        reason: 'Affinité neutralisée.',
        ...this.getProgression(),
      };
    }
    const previousDust = this.dust;
    const previousAffinity = this.affinity;
    const wasUnlocked = this.unlockedAffinities[affinity];
    if (!wasUnlocked) {
      const cost = affinityUnlockCost(affinity);
      if (this.dust < cost) {
        return {
          success: false,
          reason: `Il faut ${cost} poussières d’éther.`,
          ...this.getProgression(),
        };
      }
      this.dust -= cost;
      this.unlockedAffinities[affinity] = true;
    }
    this.affinity = affinity;
    if (!this.saveProgress()) {
      this.dust = previousDust;
      this.affinity = previousAffinity;
      this.unlockedAffinities[affinity] = wasUnlocked;
      this.pushHud(true);
      return {
        success: false,
        reason: 'Sauvegarde indisponible : aucun serment dépensé.',
        ...this.getProgression(),
      };
    }
    void this.audio.unlock();
    this.audio.play('upgrade');
    this.pushHud(true);
    return {
      success: true,
      reason: 'Affinité accordée.',
      ...this.getProgression(),
    };
  }

  getProgression() {
    return {
      dust: this.dust,
      highScore: this.highScore,
      runsCompleted: this.runsCompleted,
      victories: this.victories,
      affinity: this.affinity,
      unlockedAffinities: { ...this.unlockedAffinities },
      affinityCosts: {
        braise: affinityUnlockCost('braise'),
        prisme: affinityUnlockCost('prisme'),
        neant: affinityUnlockCost('neant'),
      },
      storageAvailable: this.storageAvailable,
    };
  }

  rerollUpgrades() {
    if (this.phase !== 'upgrade') return false;
    const now = performance.now();
    if (now - this.lastRerollAt < 300) return false;
    const cost = recalibrationCost(this.rerollsThisRun);
    if (this.dust < cost) return false;
    const previousChoices = [...this.currentUpgradeChoices];
    this.dust -= cost;
    this.rerollsThisRun += 1;
    this.offerUpgradeChoices(
      new Set(previousChoices.map((choice) => choice.id)),
    );
    if (!this.saveProgress()) {
      this.dust += cost;
      this.rerollsThisRun -= 1;
      this.currentUpgradeChoices = previousChoices;
      this.callbacks.onUpgrade(previousChoices);
      this.pushHud(true);
      return false;
    }
    this.lastRerollAt = now;
    this.audio.play('upgrade');
    this.pushHud(true);
    return true;
  }

  togglePause() {
    if (this.phase === 'playing') {
      this.setPhase('paused');
    } else if (this.phase === 'paused') {
      this.lastFrameTime = performance.now() / 1000;
      this.setPhase('playing');
    }
  }

  chooseUpgrade(id: UpgradeId) {
    if (this.phase !== 'upgrade') return;
    if (!this.currentUpgradeChoices.some((choice) => choice.id === id)) return;
    this.currentUpgradeChoices = [];
    const rank = (this.upgradeRanks.get(id) ?? 0) + 1;
    this.upgradeRanks.set(id, rank);
    switch (id) {
      case 'forked-bolt':
        this.stats.boltCount = Math.min(5, this.stats.boltCount + 1);
        break;
      case 'arcane-force':
        this.stats.boltDamage *= 1.32;
        this.stats.fireRate = Math.max(0.12, this.stats.fireRate * 0.91);
        break;
      case 'piercing-light':
        this.stats.pierce += 1;
        break;
      case 'prism-ward':
        this.stats.shieldPower += 18;
        this.health = Math.min(this.stats.maxHealth, this.health + 24);
        break;
      case 'rift-step':
        this.stats.dashLevel += 1;
        this.stats.dashBlast += 18;
        break;
      case 'void-well':
        this.stats.gravityPower += 0.34;
        this.stats.gravityCooldownScale *= 0.86;
        break;
      case 'vital-surge':
        this.stats.maxHealth += 30;
        this.health = this.stats.maxHealth;
        break;
      case 'echo-burst':
        this.stats.dashBlast += 34;
        break;
      case 'mana-flow':
        this.mana = this.maxMana;
        break;
    }
    this.audio.play('upgrade');
    if (this.upgradeReason === 'rift') {
      this.wave += 1;
      this.riftProgress = 0;
      if (isBossWave(this.wave)) this.voidPressure = 0;
      this.moveRiftToWave();
    }
    this.spawnTimer = 0.35;
    for (const enemy of this.enemies) {
      enemy.attackTimer = Math.max(enemy.attackTimer, 0.9);
      enemy.shootTimer = Math.max(enemy.shootTimer, 1.1);
    }
    this.setPhase('playing');
    this.showMessage(`RÉSONANCE ${rank} // VAGUE ${this.wave}`, 2.4);
  }

  triggerAbility(id: AbilityId) {
    if (this.phase !== 'playing') return;
    if (id === 'gravity') this.castGravityWell();
    if (id === 'shield') this.castShield();
    if (id === 'dash') this.castDash();
    if (id === 'ultimate') this.castUltimate();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.audio.setMuted(muted);
    this.saveProgress();
    this.pushHud(true);
  }

  getMuted() {
    return this.muted;
  }

  triggerPrimary() {
    this.fireBolt();
  }

  setTouchMove(x: number, y: number) {
    this.touchMove.set(clamp(x, -1, 1), clamp(y, -1, 1));
  }

  setTouchAttack(active: boolean) {
    this.touchAttack = active;
  }

  getPhase() {
    return this.phase;
  }

  dispose() {
    if (this.qaMode) delete window.__riftTest;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.unbindEvents();
    this.audio.dispose();
    this.clearEntities();
    this.scene.traverse((object) => {
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.Line ||
        object instanceof THREE.Points
      ) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.renderer.dispose();
  }

  private bindEvents() {
    window.addEventListener('storage', this.onStorage);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  private unbindEvents() {
    window.removeEventListener('storage', this.onStorage);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (document.querySelector('dialog[data-system-dialog]')) return;
    const pauseKey = event.code === 'Escape' || event.code === 'KeyP';
    if (pauseKey && (this.phase === 'playing' || this.phase === 'paused')) {
      event.preventDefault();
      this.togglePause();
      return;
    }
    const target = event.target;
    const interactiveTarget =
      target instanceof Element &&
      target.closest(
        'button, input, textarea, select, a, [contenteditable="true"]',
      );
    if (this.phase !== 'playing') return;
    if (interactiveTarget && (event.code === 'Space' || event.code === 'Enter'))
      return;
    const blocked = [
      'Space',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
    ];
    if (blocked.includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'Space') this.triggerAbility('dash');
    if (event.code === 'KeyF') this.triggerAbility('shield');
    if (event.code === 'Digit2') this.triggerAbility('gravity');
    if (event.code === 'KeyR') this.triggerAbility('ultimate');
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  private onWindowBlur = () => {
    this.keys.clear();
    this.mouseHeld = false;
    this.gamepadButtons.clear();
    this.gamepadNeedsRelease = true;
    if (this.phase === 'playing') this.setPhase('paused');
  };

  private onVisibility = () => {
    if (document.hidden) this.onWindowBlur();
  };

  private onPointerMove = (event: PointerEvent) => {
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  };

  private onPointerDown = (event: PointerEvent) => {
    if (event.button === 0) {
      this.mouseHeld = true;
      void this.audio.unlock();
    }
    if (event.button === 2) this.triggerAbility('gravity');
  };

  private onPointerUp = (event: PointerEvent) => {
    if (event.button === 0) this.mouseHeld = false;
  };

  private onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  private resize = () => {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private getActiveGamepad() {
    const gamepads = navigator.getGamepads?.();
    if (!gamepads) return null;
    for (const gamepad of gamepads) {
      if (gamepad?.connected) return gamepad;
    }
    return null;
  }

  private updateGamepadActions() {
    if (document.hidden || !document.hasFocus()) {
      this.gamepadNeedsRelease = true;
      this.gamepadButtons.clear();
      return;
    }
    const gamepad = this.getActiveGamepad();
    if (!gamepad) {
      this.gamepadButtons.clear();
      return;
    }
    if (this.gamepadNeedsRelease) {
      if (gamepad.buttons.every((button) => button.value <= 0.35))
        this.gamepadNeedsRelease = false;
      return;
    }
    const justPressed = (buttonIndex: number) => {
      const pressed = (gamepad.buttons[buttonIndex]?.value ?? 0) > 0.35;
      const wasPressed = this.gamepadButtons.get(buttonIndex) ?? false;
      this.gamepadButtons.set(buttonIndex, pressed);
      return pressed && !wasPressed;
    };
    const confirmPressed = justPressed(0);
    const thirdChoicePressed = justPressed(1);
    const secondChoicePressed = justPressed(2);
    const ultimatePressed = justPressed(3);
    const shieldPressed = justPressed(4);
    const gravityPressed = justPressed(6);
    const pausePressed = justPressed(9);
    const previousPressed = justPressed(12);
    const nextPressed = justPressed(13);
    const leftPressed = justPressed(14);
    const rightPressed = justPressed(15);
    const systemDialog = document.querySelector<HTMLDialogElement>(
      'dialog[data-system-dialog], .archive-overlay[open]',
    );
    if (systemDialog) {
      const elements = Array.from(
        systemDialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const current = elements.indexOf(document.activeElement as HTMLElement);
      if (nextPressed || previousPressed) {
        const target =
          elements[
            (current + (nextPressed ? 1 : -1) + elements.length) %
              elements.length
          ];
        target?.focus();
        target?.scrollIntoView({ block: 'nearest' });
      }
      if (confirmPressed && document.activeElement instanceof HTMLElement)
        document.activeElement.click();
      const focused = document.activeElement;
      if (leftPressed || rightPressed) {
        const direction = rightPressed ? 1 : -1;
        if (focused instanceof HTMLSelectElement) {
          focused.selectedIndex = Math.max(
            0,
            Math.min(
              focused.options.length - 1,
              focused.selectedIndex + direction,
            ),
          );
          focused.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (
          focused instanceof HTMLInputElement &&
          focused.type === 'range'
        ) {
          const next = Math.max(
            Number(focused.min || 0),
            Math.min(
              Number(focused.max || 100),
              Number(focused.value) + direction * Number(focused.step || 1),
            ),
          );
          // Use the native setter so React receives a real input value change.
          Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
          )?.set?.call(focused, String(next));
          focused.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      if (thirdChoicePressed)
        systemDialog.dispatchEvent(new Event('cancel', { cancelable: true }));
      return;
    }
    if (this.phase === 'menu') {
      if (leftPressed || rightPressed) {
        const current = CHARACTERS.findIndex(
          (entry) => entry.id === this.career.character,
        );
        this.configureRun(
          CHARACTERS[(current + (rightPressed ? 1 : 3)) % 4].id,
          this.career.mode,
          this.career.difficulty,
        );
      }
      if (nextPressed || previousPressed)
        this.configureRun(
          this.career.character,
          this.career.mode === 'endless' ? 'expedition' : 'endless',
          this.career.difficulty,
        );
      if (secondChoicePressed) {
        const choices: Difficulty[] = ['discovery', 'standard', 'cataclysm'];
        this.configureRun(
          this.career.character,
          this.career.mode,
          choices[(choices.indexOf(this.career.difficulty) + 1) % 3],
        );
      }
      if (ultimatePressed)
        document
          .querySelector<HTMLButtonElement>('[data-journal-trigger]')
          ?.click();
    }
    if (this.phase === 'camp' && thirdChoicePressed) {
      this.extractRun();
      return;
    }
    if (
      (this.phase === 'gameover' || this.phase === 'victory') &&
      thirdChoicePressed
    ) {
      this.returnToMenu();
      return;
    }

    if (pausePressed && (this.phase === 'playing' || this.phase === 'paused')) {
      this.togglePause();
    }
    if (confirmPressed) {
      if (this.phase === 'menu' && !document.querySelector('dialog[open]')) {
        this.start();
      } else if (this.phase === 'paused') {
        this.togglePause();
      } else if (this.phase === 'playing') {
        this.triggerAbility('dash');
      } else if (this.phase === 'upgrade') {
        const choice = this.currentUpgradeChoices[0];
        if (choice) this.chooseUpgrade(choice.id);
      } else if (this.phase === 'gameover' || this.phase === 'victory') {
        this.start();
      } else if (this.phase === 'camp') {
        this.continueEndurance();
      }
    }
    if (this.phase === 'upgrade' && secondChoicePressed) {
      const choice = this.currentUpgradeChoices[1];
      if (choice) this.chooseUpgrade(choice.id);
    }
    if (this.phase === 'upgrade' && thirdChoicePressed) {
      const choice = this.currentUpgradeChoices[2];
      if (choice) this.chooseUpgrade(choice.id);
    }
    if (this.phase === 'playing') {
      if (ultimatePressed) this.triggerAbility('ultimate');
      if (shieldPressed) this.triggerAbility('shield');
      if (gravityPressed) this.triggerAbility('gravity');
    }
  }

  private loop = () => {
    this.animationFrame = requestAnimationFrame(this.loop);
    const now = performance.now() / 1000;
    const delta = Math.min(Math.max(0, now - this.lastFrameTime), 0.04);
    this.lastFrameTime = now;
    this.visualElapsed += delta;
    const elapsed = this.visualElapsed;

    this.updateGamepadActions();
    this.updateVisuals(delta, elapsed);
    if (this.phase === 'playing') {
      this.updateGame(delta);
    }
    this.updateCamera(delta, elapsed);
    this.renderer.render(this.scene, this.camera);
  };

  private updateGame(delta: number) {
    this.elapsed += delta;
    this.messageTimer = Math.max(0, this.messageTimer - delta);
    this.comboTimer = Math.max(0, this.comboTimer - delta);
    if (this.comboTimer === 0) this.combo = 0;
    this.shotTimer = Math.max(0, this.shotTimer - delta);
    this.gravityCooldown = Math.max(0, this.gravityCooldown - delta);
    this.shieldCooldown = Math.max(0, this.shieldCooldown - delta);
    this.shieldTime = Math.max(0, this.shieldTime - delta);
    this.invulnerable = Math.max(0, this.invulnerable - delta);
    this.mana = Math.min(
      this.maxMana,
      this.mana + delta * (7 + 1.5 * this.rank('mana-flow')),
    );
    this.shieldMesh.visible = this.shieldTime > 0;

    if (this.dashCharges < 2) {
      this.dashRecharge += delta;
      if (this.dashRecharge >= dashRechargeTime(this.stats.dashLevel)) {
        this.dashRecharge = 0;
        this.dashCharges += 1;
      }
    }

    this.updateAim();
    this.updatePlayer(delta);
    if (this.mouseHeld || this.touchAttack) this.fireBolt();
    this.updateWave(delta);
    if (this.phase !== 'playing') return;
    this.updateEnemies(delta);
    if (this.phase !== 'playing') return;
    this.updateProjectiles(delta);
    if (this.phase !== 'playing') return;
    this.updateAreas(delta);
    if (this.phase !== 'playing') return;
    this.updateParticles(delta);
    this.updatePickups(delta);
    // Level offers are deferred to a frame boundary: damage loops never skip rifts.
    if (this.phase === 'playing' && this.pendingLevels > 0) {
      this.pendingLevels -= 1;
      this.upgradeReason = 'level';
      this.offerUpgradeChoices();
      if (this.currentUpgradeChoices.length) this.setPhase('upgrade');
      else this.grantMasteryReward();
    }
    this.pushHud();
  }

  private updateAim() {
    if (
      this.career.settings.autoAim ||
      this.touchAttack ||
      Math.abs(this.touchMove.x) + Math.abs(this.touchMove.y) > 0
    ) {
      const nearest = this.getNearestEnemy();
      if (nearest) {
        this.aimPoint.lerp(nearest.group.position, 0.62);
        this.clampAimPointToArena();
        this.aimMarker.position.set(this.aimPoint.x, 0.025, this.aimPoint.z);
        return;
      }
    }
    const gamepad = this.getActiveGamepad();
    const gamepadAimX = gamepad?.axes[2] ?? 0;
    const gamepadAimY = gamepad?.axes[3] ?? 0;
    if (Math.abs(gamepadAimX) + Math.abs(gamepadAimY) > 0.3) {
      this.aimPoint.set(
        this.player.position.x + gamepadAimX * 6,
        0,
        this.player.position.z + gamepadAimY * 6,
      );
      this.clampAimPointToArena();
      this.aimMarker.position.set(this.aimPoint.x, 0.025, this.aimPoint.z);
      return;
    }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const target = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, target)) {
      this.aimPoint.lerp(target, 0.42);
    }
    this.clampAimPointToArena();
    this.aimMarker.position.set(this.aimPoint.x, 0.025, this.aimPoint.z);
  }

  private clampAimPointToArena() {
    const radius = Math.hypot(this.aimPoint.x, this.aimPoint.z);
    if (radius <= 9.1) return;
    this.aimPoint.x *= 9.1 / radius;
    this.aimPoint.z *= 9.1 / radius;
  }

  private updatePlayer(delta: number) {
    const horizontal =
      Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) -
      Number(
        this.keys.has('KeyA') ||
          this.keys.has('KeyQ') ||
          this.keys.has('ArrowLeft'),
      );
    const vertical =
      Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) -
      Number(
        this.keys.has('KeyW') ||
          this.keys.has('KeyZ') ||
          this.keys.has('ArrowUp'),
      );
    const move = new THREE.Vector3(
      horizontal + this.touchMove.x,
      0,
      vertical + this.touchMove.y,
    );

    const gamepad = this.getActiveGamepad();
    if (gamepad) {
      if (Math.abs(gamepad.axes[0] ?? 0) > 0.16) move.x += gamepad.axes[0];
      if (Math.abs(gamepad.axes[1] ?? 0) > 0.16) move.z += gamepad.axes[1];
      if ((gamepad.buttons[7]?.value ?? 0) > 0.3) this.fireBolt();
    }

    if (move.lengthSq() > 0) {
      move
        .normalize()
        .multiplyScalar(delta * characterById(this.career.character).speed);
      this.player.position.add(move);
      const radius = Math.hypot(this.player.position.x, this.player.position.z);
      if (radius > 9.35) {
        this.player.position.x *= 9.35 / radius;
        this.player.position.z *= 9.35 / radius;
      }
    }

    const facing = this.aimPoint.clone().sub(this.player.position);
    if (facing.lengthSq() > 0.04) {
      this.player.rotation.y = Math.atan2(facing.x, facing.z);
    }
  }

  private updateWave(delta: number) {
    if (isBossWave(this.wave)) {
      if (!this.bossSpawned) {
        this.bossSpawned = true;
        this.spawnEnemy('boss', new THREE.Vector3(0, 0, -5.5));
        this.spawnTimer = 4.5;
        this.showMessage('TYRAN DE LA CONVERGENCE // PHASE I', 3);
        this.audio.play('rift');
      } else {
        this.spawnTimer -= delta;
        if (this.spawnTimer <= 0 && this.enemies.length < 7) {
          this.spawnEnemy(Math.random() > 0.56 ? 'leech' : 'spectre');
          this.spawnTimer = this.qaMode ? 2.4 : 5.2;
        }
      }
      return;
    }

    this.spawnTimer -= delta;
    const enemyCap = Math.min(28, 8 + this.wave * 4);
    if (this.spawnTimer <= 0 && this.enemies.length < enemyCap) {
      const batch = this.qaMode
        ? 1
        : 1 + Number(this.wave >= 3 && Math.random() > 0.62);
      for (let index = 0; index < batch; index += 1) {
        this.spawnEnemy(this.rollEnemyKind());
      }
      this.spawnTimer = spawnIntervalForWave(this.wave, this.qaMode);
    }

    const channeling =
      (this.qaMode ||
        this.career.settings.autoChannel ||
        this.keys.has('KeyE') ||
        this.touchChannel ||
        (this.getActiveGamepad()?.buttons[5]?.value ?? 0) > 0.35) &&
      distance2D(this.player.position, this.riftTarget) <
        (this.qaMode ? 6.2 : 3.25);
    const nearby = this.enemies.filter(
      (enemy) =>
        enemy.kind !== 'boss' &&
        distance2D(enemy.group.position, this.riftTarget) < 3.5,
    ).length;
    const pressureScale =
      (this.qaMode ? 0.2 : 1) * DIFFICULTIES[this.career.difficulty].pressure;
    this.voidPressure = clamp(
      this.voidPressure +
        voidPressureRate({
          wave: this.wave,
          nearbyEnemies: nearby,
          enemyCount: this.enemies.length,
          channeling,
        }) *
          delta *
          pressureScale,
      0,
      100,
    );
    const pressureTier =
      this.voidPressure >= 75 ? 3 : this.voidPressure >= 50 ? 2 : 1;
    if (pressureTier > this.voidWarningTier && pressureTier >= 2) {
      this.showMessage(
        pressureTier === 3
          ? 'RUPTURE DE L’ARCHE IMMINENTE'
          : 'PRESSION DU NÉANT EN HAUSSE',
        2.2,
      );
    }
    this.voidWarningTier = pressureTier;
    if (this.voidPressure >= 100) {
      this.finishRun(false, 'void');
      return;
    }
    const multiplier = this.qaMode ? 4.8 : 1;
    this.riftProgress = clamp(
      this.riftProgress +
        riftCaptureRate(nearby, channeling) * delta * multiplier,
      0,
      100,
    );
    const fieldMaterial = this.riftField.material as THREE.MeshBasicMaterial;
    fieldMaterial.color.setHex(channeling ? 0x6ff5ff : 0x8749ff);
    fieldMaterial.opacity = channeling ? 0.52 : 0.26;

    if (this.riftProgress >= 100) this.completeWave();
  }

  private completeWave() {
    this.upgradeReason = 'rift';
    this.riftsStabilized += 1;
    this.score += 750 * this.wave;
    this.ultimate = clamp(this.ultimate + 24, 0, 100);
    this.voidPressure = Math.max(0, this.voidPressure - 28);
    this.voidWarningTier =
      this.voidPressure >= 75 ? 3 : this.voidPressure >= 50 ? 2 : 1;
    this.createBlast(this.riftTarget, 4.2, 0, 0x72efff);
    for (const enemy of this.enemies) {
      if (enemy.kind === 'boss') continue;
      const recoil = enemy.group.position.clone().sub(this.riftTarget).setY(0);
      const distance = recoil.length();
      if (distance > 4.6) continue;
      if (distance < 0.05) recoil.set(1, 0, 0);
      recoil.normalize();
      enemy.group.position.addScaledVector(
        recoil,
        Math.max(0.8, 4.8 - distance),
      );
      const arenaRadius = Math.hypot(
        enemy.group.position.x,
        enemy.group.position.z,
      );
      if (arenaRadius > 9.65) {
        enemy.group.position.x *= 9.65 / arenaRadius;
        enemy.group.position.z *= 9.65 / arenaRadius;
      }
    }
    this.clearHostileProjectiles();
    this.audio.play('rift');
    this.showMessage(`FAILLE ${this.wave} STABILISÉE`, 2.5);
    this.offerUpgradeChoices();
    if (this.currentUpgradeChoices.length) this.setPhase('upgrade');
    else {
      this.grantMasteryReward();
      this.wave += 1;
      this.riftProgress = 0;
      this.moveRiftToWave();
    }
  }

  private grantMasteryReward() {
    this.health = Math.min(this.stats.maxHealth, this.health + 25);
    this.mana = this.maxMana;
    this.score += 500;
    this.showMessage('MAÎTRISE COMPLÈTE // SOIN, MANA ET +500 SCORE', 2);
  }

  private offerUpgradeChoices(excludedIds = new Set<UpgradeId>()) {
    const allAvailable = UPGRADE_LIBRARY.filter(
      (choice) => (this.upgradeRanks.get(choice.id) ?? 0) < 3,
    );
    const shuffled = seededShuffle(
      allAvailable,
      Math.floor(
        this.score +
          this.elapsed * 10 +
          this.wave * 113 +
          this.rerollsThisRun * 7919,
      ),
    );
    const freshChoices = shuffled.filter(
      (choice) => !excludedIds.has(choice.id),
    );
    const favoredSchool = schoolForAffinity(this.affinity);
    const favored = favoredSchool
      ? (freshChoices.find((choice) => choice.school === favoredSchool) ??
        shuffled.find((choice) => choice.school === favoredSchool))
      : undefined;
    const orderedPool = [
      ...freshChoices,
      ...shuffled.filter((choice) => excludedIds.has(choice.id)),
    ];
    const choices = favored
      ? [
          favored,
          ...orderedPool
            .filter((choice) => choice.id !== favored.id)
            .slice(0, 2),
        ]
      : orderedPool.slice(0, 3);
    this.currentUpgradeChoices = choices;
    this.callbacks.onUpgrade(choices);
  }

  private rollEnemyKind(): EnemyKind {
    const roll = Math.random();
    if (this.wave >= 5 && roll > 0.78) return 'ravager';
    if (this.wave >= 4 && roll < 0.2) return 'artillery';
    if (this.wave >= 3 && roll > 0.84) return 'leech';
    if (this.wave >= 2 && roll > 0.64) return 'guardian';
    if (roll > 0.4) return 'spectre';
    return 'stalker';
  }

  private spawnEnemy(kind: EnemyKind, requestedPosition?: THREE.Vector3) {
    if (this.enemies.length >= 32) return;
    const group = new THREE.Group();
    const [bright, dark] = ENEMY_COLORS[kind];
    const material = new THREE.MeshStandardMaterial({
      color: dark,
      emissive: bright,
      emissiveIntensity: kind === 'boss' ? 2.4 : 1.2,
      metalness: 0.48,
      roughness: 0.34,
    });

    let body: THREE.Mesh;
    if (kind === 'stalker') {
      body = new THREE.Mesh(new THREE.OctahedronGeometry(0.52, 0), material);
      body.scale.set(0.72, 1.25, 0.72);
      for (let index = 0; index < 3; index += 1) {
        const claw = new THREE.Mesh(
          new THREE.ConeGeometry(0.1, 0.62, 4),
          material.clone(),
        );
        claw.position.set((index - 1) * 0.28, -0.22, 0.28);
        claw.rotation.x = Math.PI * 0.6;
        group.add(claw);
      }
    } else if (kind === 'spectre') {
      body = new THREE.Mesh(new THREE.TetrahedronGeometry(0.62, 1), material);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.64, 0.055, 6, 24),
        new THREE.MeshBasicMaterial({ color: bright }),
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.08;
      group.add(halo);
      group.userData.halo = halo;
    } else if (kind === 'guardian') {
      body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.68, 0), material);
      const guard = new THREE.Mesh(
        new THREE.BoxGeometry(1.18, 0.82, 0.12),
        new THREE.MeshStandardMaterial({
          color: 0x523514,
          emissive: bright,
          emissiveIntensity: 0.72,
          metalness: 0.75,
          roughness: 0.27,
        }),
      );
      guard.position.z = 0.52;
      group.add(guard);
      group.userData.guard = guard;
    } else if (kind === 'leech') {
      body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 8), material);
      const rings = new THREE.Mesh(
        new THREE.TorusGeometry(0.68, 0.07, 6, 24),
        new THREE.MeshBasicMaterial({ color: bright }),
      );
      rings.rotation.x = Math.PI / 2;
      group.add(rings);
      group.userData.halo = rings;
    } else if (kind === 'artillery') {
      body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.68, 0.9, 6),
        material,
      );
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.22, 1.2, 8),
        material.clone(),
      );
      barrel.rotation.x = Math.PI / 3;
      barrel.position.set(0, 0.4, 0.3);
      group.add(barrel);
    } else if (kind === 'ravager') {
      body = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.6, 4), material);
      body.rotation.x = Math.PI / 2;
    } else {
      body = new THREE.Mesh(new THREE.IcosahedronGeometry(1.34, 1), material);
      body.scale.set(0.9, 1.3, 0.9);
      const crown = new THREE.Mesh(
        new THREE.TorusKnotGeometry(1.38, 0.1, 64, 8, 2, 5),
        new THREE.MeshBasicMaterial({ color: 0xf399ff }),
      );
      crown.position.y = 0.25;
      group.add(crown);
      group.userData.halo = crown;
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.46, 1),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xe250ff,
          emissiveIntensity: 4.5,
        }),
      );
      group.add(core);
      group.userData.core = core;
    }
    body.name = 'body';
    group.add(body);

    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(kind === 'boss' ? 0.2 : 0.105, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    eye.position.set(0, 0.12, kind === 'boss' ? 1.05 : 0.46);
    group.add(eye);

    const bar = new THREE.Group();
    const barBack = new THREE.Mesh(
      new THREE.PlaneGeometry(kind === 'boss' ? 2.4 : 1.1, 0.1),
      new THREE.MeshBasicMaterial({
        color: 0x180817,
        transparent: true,
        opacity: 0.78,
      }),
    );
    const barFill = new THREE.Mesh(
      new THREE.PlaneGeometry(kind === 'boss' ? 2.34 : 1.04, 0.06),
      new THREE.MeshBasicMaterial({ color: bright }),
    );
    barFill.position.z = 0.005;
    bar.add(barBack, barFill);
    bar.position.y = kind === 'boss' ? 2.05 : 1.02;
    bar.userData.fill = barFill;
    group.add(bar);
    group.userData.healthBar = bar;

    const angle = Math.random() * Math.PI * 2;
    const position =
      requestedPosition ??
      new THREE.Vector3(Math.cos(angle) * 9.2, 0, Math.sin(angle) * 9.2);
    group.position.copy(position);
    group.position.y = kind === 'boss' ? 1.45 : 0.56;
    this.enemyRoot.add(group);

    const elite =
      kind !== 'boss' &&
      this.wave >= 3 &&
      Math.random() < Math.min(0.3, 0.12 + (this.cycle - 1) * 0.03);
    if (elite) {
      group.scale.setScalar(1.25);
      const crest = new THREE.Mesh(
        new THREE.TorusGeometry(0.8, 0.09, 6, 20),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      crest.rotation.x = Math.PI / 2;
      crest.position.y = 0.85;
      group.add(crest);
    }
    const waveScale =
      (1 + Math.max(0, this.wave - 1) * 0.16) *
      this.threat *
      DIFFICULTIES[this.career.difficulty].health *
      (elite ? 1.8 : 1);
    const baseHealth = {
      stalker: 52,
      spectre: 62,
      guardian: 125,
      leech: 88,
      artillery: 95,
      ravager: 110,
      boss: this.qaMode ? 360 : 1600,
    }[kind];
    const enemy: Enemy = {
      elite,
      bossPhase: 1,
      burn: 0,
      burnPower: 0,
      slow: 0,
      freeze: 0,
      marks: 0,
      charge: 0,
      chargeDirection: new THREE.Vector3(),
      id: this.nextEnemyId,
      kind,
      group,
      hp: baseHealth * waveScale,
      maxHp: baseHealth * waveScale,
      speed: {
        stalker: 2.4,
        spectre: 1.35,
        guardian: 1.12,
        leech: 1.65,
        artillery: 0.8,
        ravager: 1.5,
        boss: 0.82,
      }[kind],
      radius: kind === 'boss' ? 1.35 : kind === 'guardian' ? 0.72 : 0.55,
      damage: {
        stalker: 11,
        spectre: 9,
        guardian: 18,
        leech: 8,
        artillery: 16,
        ravager: 22,
        boss: 24,
      }[kind],
      attackTimer: 0.6 + Math.random(),
      shootTimer: 0.8 + Math.random(),
      healTimer: 1.2,
      flashTimer: 0,
      orbit: Math.random() > 0.5 ? 1 : -1,
    };
    this.nextEnemyId += 1;
    this.enemies.push(enemy);
  }

  private updateEnemies(delta: number) {
    const playerPosition = this.player.position;
    for (const enemy of this.enemies.slice()) {
      if (this.phase !== 'playing') break;
      if (enemy.freeze > 0 && enemy.kind !== 'boss') {
        enemy.freeze = Math.max(0, enemy.freeze - delta);
        continue;
      }
      enemy.attackTimer -= delta;
      enemy.shootTimer -= delta;
      enemy.healTimer -= delta;
      enemy.flashTimer = Math.max(0, enemy.flashTimer - delta);
      enemy.slow = Math.max(0, enemy.slow - delta);
      if (enemy.burn > 0) {
        enemy.burn = Math.max(0, enemy.burn - delta);
        this.damageEnemy(
          enemy,
          enemy.burnPower * delta,
          enemy.group.position,
          true,
        );
        if (enemy.burn === 0) enemy.burnPower = 0;
        if (!this.enemies.includes(enemy)) continue;
      }
      const step =
        delta * (enemy.slow > 0 ? (enemy.kind === 'boss' ? 0.7 : 0.35) : 1);
      const body = enemy.group.getObjectByName('body') as THREE.Mesh;
      const material = body.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity =
        enemy.flashTimer > 0 ? 4.8 : enemy.kind === 'boss' ? 2.4 : 1.2;
      const healthBar = enemy.group.userData.healthBar as THREE.Group;
      healthBar.lookAt(this.camera.position);
      const fill = healthBar.userData.fill as THREE.Mesh;
      fill.scale.x = clamp(enemy.hp / enemy.maxHp, 0, 1);
      fill.position.x =
        -((enemy.kind === 'boss' ? 2.34 : 1.04) * (1 - fill.scale.x)) / 2;

      const toPlayer = playerPosition.clone().sub(enemy.group.position);
      toPlayer.y = 0;
      const distance = Math.max(0.001, toPlayer.length());
      const direction = toPlayer.clone().normalize();
      enemy.group.lookAt(
        playerPosition.x,
        enemy.group.position.y,
        playerPosition.z,
      );

      if (enemy.kind === 'artillery') {
        if (distance < 5)
          enemy.group.position.addScaledVector(direction, -enemy.speed * step);
        if (enemy.shootTimer <= 0) {
          this.createDangerZone(
            playerPosition.clone(),
            enemy.elite ? 2.1 : 1.5,
            1.35,
            22,
          );
          enemy.shootTimer = enemy.elite ? 2.6 : 3.5;
        }
      } else if (enemy.kind === 'ravager') {
        if (enemy.charge > 0) {
          enemy.charge -= delta;
          material.emissiveIntensity = 4;
          if (enemy.charge <= 0) enemy.charge = -0.65;
        } else if (enemy.charge < 0) {
          enemy.group.position.addScaledVector(
            enemy.chargeDirection,
            step * 11,
          );
          enemy.charge = Math.min(0, enemy.charge + delta);
        } else {
          enemy.group.position.addScaledVector(direction, enemy.speed * step);
          if (enemy.shootTimer <= 0) {
            enemy.chargeDirection.copy(direction);
            enemy.charge = 0.85;
            enemy.shootTimer = 4.8;
            this.createDangerZone(
              enemy.group.position.clone().addScaledVector(direction, 3),
              0.65,
              0.85,
              0,
            );
          }
        }
        if (distance < 1.25 && enemy.attackTimer <= 0) {
          this.damagePlayer(enemy.damage * (enemy.elite ? 1.25 : 1));
          enemy.attackTimer = 1.1;
        }
      } else if (enemy.kind === 'spectre') {
        if (distance > 5.6) {
          enemy.group.position.addScaledVector(direction, enemy.speed * step);
        } else if (distance < 3.6) {
          enemy.group.position.addScaledVector(direction, -enemy.speed * step);
        } else {
          enemy.group.position.x += direction.z * enemy.orbit * step * 1.1;
          enemy.group.position.z -= direction.x * enemy.orbit * step * 1.1;
        }
        if (enemy.shootTimer <= 0) {
          this.fireEnemyProjectile(enemy, 8.5, 9);
          if (enemy.elite)
            this.fireEnemyProjectile(
              enemy,
              7.5,
              11,
              direction
                .clone()
                .applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.18),
            );
          enemy.shootTimer = 2.1 - Math.min(0.5, this.wave * 0.1);
        }
      } else if (enemy.kind === 'leech') {
        const toRift = this.riftTarget.clone().sub(enemy.group.position);
        toRift.y = 0;
        if (toRift.length() > 1.8) {
          enemy.group.position.addScaledVector(
            toRift.normalize(),
            enemy.speed * step,
          );
        } else if (enemy.healTimer <= 0) {
          this.riftProgress = Math.max(0, this.riftProgress - 2.5);
          this.voidPressure = clamp(this.voidPressure + 2.4, 0, 100);
          const boss = this.enemies.find((target) => target.kind === 'boss');
          if (boss) boss.hp = Math.min(boss.maxHp, boss.hp + 18);
          this.spawnParticles(enemy.group.position, 0x9bff83, 3);
          enemy.healTimer = 1.25;
        }
      } else if (enemy.kind === 'boss') {
        const nextPhase = bossPhaseAt(enemy.hp / enemy.maxHp, enemy.bossPhase);
        if (nextPhase > enemy.bossPhase) {
          enemy.bossPhase = nextPhase;
          this.showMessage(
            `TYRAN // PHASE ${nextPhase} — ${nextPhase === 2 ? 'INVOCATION' : 'CONVERGENCE'}`,
            3,
          );
          for (let summon = 0; summon < nextPhase; summon += 1)
            this.spawnEnemy(summon % 2 ? 'artillery' : 'stalker');
        }
        if (distance > 4.1) {
          enemy.group.position.addScaledVector(direction, enemy.speed * step);
        }
        const halo = enemy.group.userData.halo as THREE.Mesh;
        halo.rotation.x += delta * 0.45;
        halo.rotation.y -= delta * 0.7;
        const core = enemy.group.userData.core as THREE.Mesh;
        core.rotation.y += delta * 1.8;
        if (enemy.shootTimer <= 0) {
          const bolts = 8 + enemy.bossPhase * 2;
          for (let index = 0; index < bolts; index += 1) {
            const angle = (index / bolts) * Math.PI * 2 + this.elapsed * 0.3;
            this.fireEnemyProjectile(
              enemy,
              6.2,
              13,
              new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)),
            );
          }
          if (enemy.bossPhase >= 2)
            this.createDangerZone(playerPosition.clone(), 2.2, 1.2, 28);
          if (enemy.bossPhase >= 3)
            this.createDangerZone(this.riftTarget.clone(), 2.6, 1.65, 30);
          enemy.shootTimer = 3.4 - enemy.bossPhase * 0.4;
          this.shake = 0.38;
        }
        if (enemy.attackTimer <= 0 && distance < 2.4) {
          this.damagePlayer(enemy.damage);
          enemy.attackTimer = 1.45;
        }
      } else {
        if (distance > enemy.radius + 0.62) {
          enemy.group.position.addScaledVector(direction, enemy.speed * step);
        } else if (enemy.attackTimer <= 0) {
          this.damagePlayer(enemy.damage * (enemy.elite ? 1.25 : 1));
          enemy.attackTimer = enemy.kind === 'guardian' ? 1.4 : 0.92;
        }
      }

      const arenaRadius = Math.hypot(
        enemy.group.position.x,
        enemy.group.position.z,
      );
      if (arenaRadius > 9.65) {
        enemy.group.position.x *= 9.65 / arenaRadius;
        enemy.group.position.z *= 9.65 / arenaRadius;
      }
      const baseY = enemy.kind === 'boss' ? 1.45 : 0.56;
      enemy.group.position.y =
        baseY + Math.sin(this.elapsed * 2.2 + enemy.id) * 0.07;
      const halo = enemy.group.userData.halo as THREE.Mesh | undefined;
      if (halo) halo.rotation.z += delta * enemy.orbit * 1.2;
    }
  }

  private gainExperience(amount: number) {
    this.experience += amount;
    while (this.experience >= experienceForLevel(this.level)) {
      this.experience -= experienceForLevel(this.level);
      this.level += 1;
      this.pendingLevels += 1;
    }
  }

  private applyElementalImpact(enemy: Enemy, damage: number) {
    if (this.phase !== 'playing') return;
    const character = this.career.character;
    const alive = this.enemies.includes(enemy);
    const burnRank = this.rank('ember') + Number(character === 'kaela');
    const slowRank = this.rank('stasis') + Number(character === 'elias');
    const markRank = this.rank('void-mark') + Number(character === 'nyx');
    if (alive && burnRank > 0) {
      enemy.burn = Math.max(enemy.burn, 3);
      enemy.burnPower = Math.max(enemy.burnPower, 5 * burnRank);
    }
    if (alive && slowRank > 0) enemy.slow = 1.2 + 0.6 * slowRank;
    if (alive && markRank > 0) {
      enemy.marks += 1;
      if (enemy.marks >= 3) {
        enemy.marks = 0;
        this.damageEnemy(
          enemy,
          damage * (0.8 + 0.35 * markRank),
          enemy.group.position,
        );
      }
    }
    // Secondary hits intentionally do not call applyElementalImpact: no recursive chains.
    const chainCount = this.rank('chain') + Number(character === 'orin');
    if (chainCount > 0) {
      const targets = this.enemies
        .filter(
          (target) =>
            target !== enemy &&
            distance2D(target.group.position, enemy.group.position) < 3.8,
        )
        .sort(
          (a, b) =>
            distance2D(a.group.position, enemy.group.position) -
            distance2D(b.group.position, enemy.group.position),
        )
        .slice(0, chainCount);
      for (const target of targets) {
        this.spawnParticles(target.group.position, 0x75eaff, 3);
        this.damageEnemy(target, damage * 0.35, target.group.position);
      }
    }
  }

  private spawnPickup(position: THREE.Vector3) {
    if (this.pickups.length >= 48 || Math.random() > 0.42) return;
    const roll = Math.random();
    const kind = roll < 0.3 ? 'health' : roll < 0.6 ? 'mana' : 'essence';
    const mesh = new THREE.Mesh(
      kind === 'health'
        ? new THREE.BoxGeometry(0.23, 0.23, 0.23)
        : kind === 'mana'
          ? new THREE.OctahedronGeometry(0.22)
          : new THREE.TetrahedronGeometry(0.25),
      new THREE.MeshBasicMaterial({
        color: { health: 0x9df2b0, mana: 0x75eaff, essence: 0xffd37a }[kind],
      }),
    );
    mesh.position.copy(position).setY(0.35);
    this.effectRoot.add(mesh);
    this.pickups.push({ mesh, kind, life: 22 });
  }

  private updatePickups(delta: number) {
    for (let index = this.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = this.pickups[index];
      pickup.life -= delta;
      pickup.mesh.rotation.y += delta * 2;
      const distance = distance2D(pickup.mesh.position, this.player.position);
      if (distance < 3 + this.rank('soul-siphon') * 0.5)
        pickup.mesh.position.lerp(
          this.player.position.clone().setY(0.35),
          Math.min(1, delta * 5),
        );
      if (distance < 0.85) {
        if (pickup.kind === 'health')
          this.health = Math.min(this.stats.maxHealth, this.health + 18);
        if (pickup.kind === 'mana')
          this.mana = Math.min(this.maxMana, this.mana + 25);
        if (pickup.kind === 'essence') {
          this.gainExperience(15);
          this.score += 50;
        }
        pickup.life = 0;
      }
      if (pickup.life <= 0) {
        this.effectRoot.remove(pickup.mesh);
        this.disposeObject(pickup.mesh);
        this.pickups.splice(index, 1);
      }
    }
  }

  private damageEnemy(
    enemy: Enemy,
    amount: number,
    impact: THREE.Vector3,
    silent = false,
  ) {
    if (!this.enemies.includes(enemy) || this.phase !== 'playing') return;
    enemy.hp -= amount;
    enemy.flashTimer = 0.08;
    if (!silent) this.audio.play('hit');
    if (!silent)
      this.spawnParticles(
        impact,
        ENEMY_COLORS[enemy.kind][0],
        enemy.kind === 'boss' ? 5 : 2,
      );
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  private killEnemy(enemy: Enemy) {
    const index = this.enemies.indexOf(enemy);
    if (index < 0) return;
    this.enemies.splice(index, 1);
    this.enemyRoot.remove(enemy.group);
    this.spawnParticles(
      enemy.group.position,
      ENEMY_COLORS[enemy.kind][0],
      enemy.kind === 'boss' ? 28 : 8,
    );
    this.disposeObject(enemy.group);
    this.score += scoreForKill(enemy.kind, this.wave) * Math.max(1, this.combo);
    if (enemy.elite) this.score += scoreForKill(enemy.kind, this.wave);
    this.kills += 1;
    this.gainExperience(enemy.kind === 'boss' ? 120 : enemy.elite ? 28 : 14);
    this.health = Math.min(
      this.stats.maxHealth,
      this.health + this.rank('soul-siphon'),
    );
    if (enemy.kind !== 'boss') this.spawnPickup(enemy.group.position);
    this.combo = Math.min(9, this.combo + 1);
    this.comboTimer = 2.8;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.ultimate = clamp(
      this.ultimate +
        (enemy.kind === 'boss' ? 100 : 9 + this.rank('convergence') * 2),
      0,
      100,
    );
    if (!isBossWave(this.wave)) {
      this.voidPressure = Math.max(
        0,
        this.voidPressure - (enemy.kind === 'leech' ? 4.5 : 1.2),
      );
    }
    this.audio.play('kill');

    if (enemy.kind === 'boss') {
      this.completedCycles += 1;
      if (this.career.mode === 'endless') {
        this.saveCheckpoint();
        this.setPhase('camp');
      } else this.finishRun(true);
    }
  }

  private damagePlayer(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (this.invulnerable > 0 || this.phase !== 'playing') return;
    const result = resolveDamage(
      this.health,
      this.shield,
      amount *
        DIFFICULTIES[this.career.difficulty].damage *
        Math.min(2, this.threat),
    );
    this.health = result.health;
    this.shield = result.shield;
    this.invulnerable = 0.36;
    this.shake = this.reducedMotion ? 0 : 0.46;
    this.audio.play('hurt');
    this.showMessage(
      result.absorbed > 0 ? 'ÉGIDE IMPACTÉE' : 'TRAME ENDOMMAGÉE',
      0.8,
    );
    if (this.health <= 0) this.finishRun(false);
  }

  private fireBolt() {
    if (this.shotTimer > 0 || this.phase !== 'playing') return;
    if (this.projectiles.length >= 220) return;
    const origin = this.player.position.clone();
    origin.y = 0.82;
    const baseDirection = this.aimPoint.clone().sub(origin);
    baseDirection.y = 0;
    if (baseDirection.lengthSq() < 0.08) baseDirection.set(0, 0, -1);
    baseDirection.normalize();
    const count = this.stats.boltCount;
    for (let index = 0; index < count; index += 1) {
      const offset = index - (count - 1) / 2;
      const direction = baseDirection
        .clone()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), offset * 0.12);
      const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.12, 0),
        new THREE.MeshBasicMaterial({
          color: characterById(this.career.character).hex,
        }),
      );
      mesh.position.copy(origin);
      mesh.scale.set(0.72, 0.72, 1.7);
      mesh.lookAt(origin.clone().add(direction));
      this.projectileRoot.add(mesh);
      this.projectiles.push({
        mesh,
        velocity: direction.multiplyScalar(12.8),
        life: 1.4,
        radius: 0.22,
        damage: this.stats.boltDamage,
        hostile: false,
        pierce: this.stats.pierce,
        hitIds: new Set(),
      });
    }
    this.shotTimer = this.stats.fireRate;
    this.audio.play('shot');
  }

  private fireEnemyProjectile(
    enemy: Enemy,
    speed: number,
    damage: number,
    requestedDirection?: THREE.Vector3,
  ) {
    if (this.projectiles.length >= 220) return;
    const origin = enemy.group.position.clone();
    const direction =
      requestedDirection ??
      this.player.position
        .clone()
        .sub(enemy.group.position)
        .setY(0)
        .normalize();
    const radius = enemy.kind === 'boss' ? 0.17 : 0.13;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 8, 6),
      new THREE.MeshBasicMaterial({
        color: enemy.kind === 'boss' ? 0xff77ef : 0xff5e9f,
      }),
    );
    mesh.position.copy(origin);
    mesh.position.y = enemy.kind === 'boss' ? 1.15 : 0.66;
    this.projectileRoot.add(mesh);
    this.projectiles.push({
      mesh,
      velocity: direction.clone().normalize().multiplyScalar(speed),
      life: 3.2,
      radius: radius + 0.12,
      damage,
      hostile: true,
      pierce: 0,
      hitIds: new Set(),
    });
  }

  private updateProjectiles(delta: number) {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      if (this.phase !== 'playing') break;
      const projectile = this.projectiles[index];
      projectile.life -= delta;
      projectile.mesh.position.addScaledVector(projectile.velocity, delta);
      projectile.mesh.rotation.x += delta * 6;
      projectile.mesh.rotation.y += delta * 8;
      let remove = projectile.life <= 0;

      if (projectile.hostile && !remove) {
        const distance = distance2D(
          projectile.mesh.position,
          this.player.position,
        );
        if (distance < projectile.radius + 0.48) {
          if (this.shieldTime > 0) {
            projectile.hostile = false;
            projectile.velocity
              .copy(projectile.mesh.position)
              .sub(this.player.position)
              .setY(0)
              .normalize()
              .multiplyScalar(11);
            projectile.damage = 42;
            projectile.life = 1.5;
            const material = projectile.mesh
              .material as THREE.MeshBasicMaterial;
            material.color.setHex(0x8ff7ff);
            this.audio.play('shield');
          } else {
            this.damagePlayer(projectile.damage);
            remove = true;
          }
        }
      } else if (!projectile.hostile && !remove) {
        for (const enemy of this.enemies.slice()) {
          if (projectile.hitIds.has(enemy.id)) continue;
          const distance = distance2D(
            projectile.mesh.position,
            enemy.group.position,
          );
          if (distance < projectile.radius + enemy.radius) {
            projectile.hitIds.add(enemy.id);
            this.damageEnemy(
              enemy,
              projectile.damage,
              projectile.mesh.position,
            );
            this.applyElementalImpact(enemy, projectile.damage);
            if (projectile.pierce > 0) {
              projectile.pierce -= 1;
              projectile.damage *= 0.82;
            } else {
              remove = true;
            }
            break;
          }
        }
      }

      if (
        Math.hypot(projectile.mesh.position.x, projectile.mesh.position.z) > 12
      ) {
        remove = true;
      }
      if (remove) this.removeProjectile(index);
    }
  }

  private removeProjectile(index: number) {
    const projectile = this.projectiles[index];
    if (!projectile) return;
    this.projectileRoot.remove(projectile.mesh);
    projectile.mesh.geometry.dispose();
    (projectile.mesh.material as THREE.Material).dispose();
    this.projectiles.splice(index, 1);
  }

  private castGravityWell() {
    if (this.gravityCooldown > 0) {
      this.showMessage(`PUITS // ${Math.ceil(this.gravityCooldown)}S`, 0.7);
      return;
    }
    if (this.mana < 30) {
      this.showMessage('ARCANE // 30 MANA REQUIS', 1);
      return;
    }
    this.mana -= 30;
    this.gravityCooldown = 8.5 * this.stats.gravityCooldownScale;
    const caster = characterById(this.career.character);
    if (caster.id === 'orin') {
      this.createBlast(
        this.aimPoint,
        3.5,
        75 * this.stats.gravityPower,
        caster.hex,
      );
      this.audio.play('rift');
      this.showMessage('FULGURANCE', 1);
      return;
    }
    const radius = 2.7 + this.stats.gravityPower * 0.45;
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.2, radius, 46),
      new THREE.MeshBasicMaterial({
        color: caster.hex,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(this.aimPoint.x, 0.04, this.aimPoint.z);
    mesh.scale.setScalar(0.12);
    this.effectRoot.add(mesh);
    this.areas.push({
      kind:
        caster.id === 'kaela'
          ? 'flame'
          : caster.id === 'elias'
            ? 'stasis'
            : 'gravity',
      mesh,
      life: 3.1,
      duration: 3.1,
      radius,
      damage: (caster.id === 'kaela' ? 14 : 8) * this.stats.gravityPower,
      tick: 0,
    });
    this.gravityCooldown = 8.5 * this.stats.gravityCooldownScale;
    this.audio.play('rift');
    this.showMessage(caster.secondary, 1);
  }

  private castShield() {
    if (this.shieldCooldown > 0) {
      this.showMessage(`ÉGIDE // ${Math.ceil(this.shieldCooldown)}S`, 0.7);
      return;
    }
    if (this.mana < 20) {
      this.showMessage('ÉGIDE // 20 MANA REQUIS', 1);
      return;
    }
    this.mana -= 20;
    this.shield = Math.min(
      this.stats.shieldPower * 1.6,
      this.shield + this.stats.shieldPower,
    );
    this.shieldTime = 4.2;
    this.shieldCooldown = 11.5;
    this.shieldMesh.visible = true;
    this.audio.play('shield');
    this.spawnParticles(this.player.position, 0x75eaff, 12);
    this.showMessage('ÉGIDE PRISMATIQUE', 1);
  }

  private castDash() {
    if (this.dashCharges <= 0) {
      this.showMessage('ESQUIVE EN RECHARGE', 0.7);
      return;
    }
    const horizontal =
      Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) -
      Number(
        this.keys.has('KeyA') ||
          this.keys.has('KeyQ') ||
          this.keys.has('ArrowLeft'),
      );
    const vertical =
      Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) -
      Number(
        this.keys.has('KeyW') ||
          this.keys.has('KeyZ') ||
          this.keys.has('ArrowUp'),
      );
    const direction = new THREE.Vector3(
      horizontal + this.touchMove.x,
      0,
      vertical + this.touchMove.y,
    );
    const gamepad = this.getActiveGamepad();
    if (gamepad) {
      if (Math.abs(gamepad.axes[0] ?? 0) > 0.16) {
        direction.x += gamepad.axes[0];
      }
      if (Math.abs(gamepad.axes[1] ?? 0) > 0.16) {
        direction.z += gamepad.axes[1];
      }
    }
    if (direction.lengthSq() < 0.05) {
      direction.copy(this.aimPoint).sub(this.player.position).setY(0);
    }
    if (direction.lengthSq() < 0.05) {
      direction.set(
        Math.sin(this.player.rotation.y),
        0,
        Math.cos(this.player.rotation.y),
      );
    }
    direction.normalize();
    const from = this.player.position.clone();
    this.player.position.addScaledVector(direction, 2.75);
    const radius = Math.hypot(this.player.position.x, this.player.position.z);
    if (radius > 9.25) {
      this.player.position.x *= 9.25 / radius;
      this.player.position.z *= 9.25 / radius;
    }
    this.dashCharges -= 1;
    this.dashRecharge = 0;
    this.invulnerable = 0.46;
    this.audio.play('dash');
    this.spawnParticles(from, 0x5cdfff, 9);
    this.spawnParticles(this.player.position, 0xa980ff, 9);
    if (this.stats.dashBlast > 0) {
      this.createBlast(
        this.player.position,
        2.2,
        this.stats.dashBlast,
        0x69eaff,
      );
    }
  }

  private castUltimate() {
    if (this.ultimate < 100) {
      this.showMessage(`BRISURE // ${Math.floor(this.ultimate)}%`, 0.8);
      return;
    }
    this.ultimate = 0;
    this.runUltimates += 1;
    this.invulnerable = 1.1;
    this.audio.play('ultimate');
    this.clearHostileProjectiles();
    this.shake = this.reducedMotion ? 0 : 0.9;
    const caster = characterById(this.career.character);
    this.showMessage(caster.ultimate, 1.8);
    if (caster.id === 'elias') {
      this.health = Math.min(this.stats.maxHealth, this.health + 45);
      this.enemies.forEach((enemy) => {
        enemy.slow = 7;
        if (enemy.kind !== 'boss') enemy.freeze = 4;
      });
    }
    if (caster.id === 'nyx')
      this.enemies.forEach((enemy) => {
        if (enemy.kind !== 'boss')
          enemy.group.position.lerp(this.player.position, 0.7);
      });
    if (caster.id === 'kaela')
      this.enemies.forEach((enemy) => {
        enemy.burn = 6;
        enemy.burnPower = 20;
      });
    this.createBlast(
      this.player.position,
      caster.id === 'orin' ? 12 : 8.5,
      (caster.id === 'elias' ? 150 : 210) *
        (1 + this.rank('convergence') * 0.25),
      caster.hex,
    );
  }

  private createBlast(
    position: THREE.Vector3,
    radius: number,
    damage: number,
    color: number,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.5, 64),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(position.x, 0.08, position.z);
    this.effectRoot.add(mesh);
    this.areas.push({
      kind: 'blast',
      mesh,
      life: 0.48,
      duration: 0.48,
      radius,
      damage,
      tick: 1,
    });
    if (damage > 0) {
      for (const enemy of this.enemies.slice()) {
        if (
          distance2D(enemy.group.position, position) <=
          radius + enemy.radius
        ) {
          this.damageEnemy(enemy, damage, enemy.group.position);
          if (this.phase !== 'playing') break;
        }
      }
    }
  }

  private createDangerZone(
    position: THREE.Vector3,
    radius: number,
    delay: number,
    damage: number,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 48),
      new THREE.MeshBasicMaterial({
        color: 0xff377c,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(position.x, 0.035, position.z);
    this.effectRoot.add(mesh);
    this.areas.push({
      kind: 'danger',
      mesh,
      life: delay,
      duration: delay,
      radius,
      damage,
      tick: 0,
    });
  }

  private updateAreas(delta: number) {
    for (let index = this.areas.length - 1; index >= 0; index -= 1) {
      if (this.phase !== 'playing') break;
      const area = this.areas[index];
      area.life -= delta;
      const progress = 1 - clamp(area.life / area.duration, 0, 1);
      const material = area.mesh.material as THREE.MeshBasicMaterial;

      if (
        area.kind === 'gravity' ||
        area.kind === 'flame' ||
        area.kind === 'stasis'
      ) {
        area.mesh.scale.setScalar(Math.min(1, progress * 5));
        area.mesh.rotation.z -= delta * 1.8;
        area.tick -= delta;
        for (const enemy of this.enemies.slice()) {
          const toCenter = area.mesh.position.clone().sub(enemy.group.position);
          toCenter.y = 0;
          const distance = toCenter.length();
          if (distance < area.radius) {
            if (area.kind === 'gravity' && distance > 0.2)
              enemy.group.position.addScaledVector(
                toCenter.normalize(),
                delta * (2.8 + this.stats.gravityPower * 1.4),
              );
            if (area.kind === 'stasis') {
              enemy.slow = Math.max(enemy.slow, 2);
              if (enemy.kind !== 'boss')
                enemy.freeze = Math.max(enemy.freeze, 0.5);
            }
            if (area.kind === 'flame') {
              enemy.burn = Math.max(enemy.burn, 3);
              enemy.burnPower = Math.max(
                enemy.burnPower,
                6 + this.rank('ember') * 4,
              );
            }
            if (area.tick <= 0) {
              this.damageEnemy(enemy, area.damage, enemy.group.position);
              if (this.phase !== 'playing') break;
            }
          }
        }
        if (area.tick <= 0) area.tick = 0.34;
        material.opacity = Math.min(0.42, area.life * 0.45);
      } else if (area.kind === 'blast') {
        area.mesh.scale.setScalar(1 + progress * area.radius * 2);
        material.opacity = Math.max(0, 0.9 * (1 - progress));
      } else {
        area.mesh.scale.setScalar(
          0.82 + Math.sin(progress * Math.PI * 8) * 0.06,
        );
        material.opacity = 0.15 + progress * 0.42;
        if (area.life <= 0.07 && area.tick === 0) {
          area.tick = 1;
          if (
            distance2D(area.mesh.position, this.player.position) <
            area.radius + 0.45
          ) {
            this.damagePlayer(area.damage);
          }
          this.createBlast(area.mesh.position, area.radius, 0, 0xff3d88);
        }
      }

      if (area.life <= 0) {
        this.effectRoot.remove(area.mesh);
        area.mesh.geometry.dispose();
        material.dispose();
        this.areas.splice(index, 1);
      }
    }
  }

  private spawnParticles(
    position: THREE.Vector3,
    color: number,
    count: number,
  ) {
    const budget = this.reducedMotion ? Math.ceil(count * 0.35) : count;
    for (
      let index = 0;
      index < budget && this.particles.length < 90;
      index += 1
    ) {
      const mesh = new THREE.Mesh(
        new THREE.TetrahedronGeometry(0.05 + Math.random() * 0.07, 0),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.92,
        }),
      );
      mesh.position.copy(position);
      mesh.position.y += 0.2 + Math.random() * 0.75;
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        1 + Math.random() * 3.2,
        (Math.random() - 0.5) * 4,
      );
      this.effectRoot.add(mesh);
      this.particles.push({
        mesh,
        velocity,
        life: 0.45 + Math.random() * 0.55,
        duration: 1,
      });
    }
  }

  private updateParticles(delta: number) {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.life -= delta;
      particle.velocity.y -= delta * 4.2;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.mesh.rotation.x += delta * 5;
      particle.mesh.rotation.y += delta * 7;
      const material = particle.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = clamp(particle.life / particle.duration, 0, 1);
      if (particle.life <= 0) {
        this.effectRoot.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        material.dispose();
        this.particles.splice(index, 1);
      }
    }
  }

  private updateVisuals(delta: number, elapsed: number) {
    this.rift.rotation.y += delta * (this.phase === 'playing' ? 0.52 : 0.25);
    this.riftCore.rotation.x += delta * 0.3;
    this.riftCore.rotation.z += delta * 0.19;
    this.rift.children.forEach((object) => {
      if (object === this.riftCore || object === this.riftField) return;
      object.position.y =
        Math.sin(elapsed * 1.8 + (object.userData.phase ?? 0)) * 0.36;
      object.rotation.x += delta * 0.85;
      object.rotation.y += delta * 1.18;
    });
    this.riftLight.intensity = 25 + Math.sin(elapsed * 2.3) * 5;
    this.playerRing.rotation.z += delta * 1.05;
    this.playerFocus.rotation.y += delta * 1.6;
    this.playerFocus.position.y = 1.23 + Math.sin(elapsed * 3.2) * 0.07;
    this.shieldMesh.rotation.y += delta * 0.8;
    this.shieldMesh.rotation.z -= delta * 0.5;
    this.aimMarker.rotation.z += delta * 0.7;
    const focusMaterial = this.playerFocus
      .material as THREE.MeshStandardMaterial;
    focusMaterial.emissiveIntensity = this.invulnerable > 0 ? 5.5 : 3.3;

    if (this.phase === 'menu') {
      this.player.rotation.y += delta * 0.18;
      this.aimMarker.visible = false;
    } else {
      this.aimMarker.visible = this.phase === 'playing';
    }
  }

  private updateCamera(delta: number, elapsed: number) {
    const shakeScale = this.reducedMotion ? 0 : this.shake;
    this.shake = Math.max(0, this.shake - delta * 2.8);
    const follow = this.player.position.clone().multiplyScalar(0.12);
    const targetPosition = new THREE.Vector3(
      10.5 + follow.x,
      14.5,
      13 + follow.z,
    );
    if (shakeScale > 0) {
      targetPosition.x += Math.sin(elapsed * 84) * shakeScale;
      targetPosition.y += Math.cos(elapsed * 67) * shakeScale * 0.5;
    }
    this.camera.position.lerp(targetPosition, 1 - Math.exp(-delta * 4.5));
    const lookAt = new THREE.Vector3(
      this.player.position.x * 0.12,
      0,
      this.player.position.z * 0.12,
    );
    this.camera.lookAt(lookAt);
  }

  private resetRun() {
    this.clearEntities();
    this.stats = this.defaultStats();
    const caster = characterById(this.career.character);
    this.stats.maxHealth = caster.health;
    this.stats.boltDamage = caster.damage;
    this.upgradeRanks.clear();
    this.wave = 1;
    this.cycle = 1;
    this.completedCycles = 0;
    this.level = 1;
    this.experience = 0;
    this.pendingLevels = 0;
    this.kills = 0;
    this.runUltimates = 0;
    this.bestCombo = 0;
    this.newAchievements = [];
    this.mana = 100;
    this.upgradeReason = 'rift';
    this.riftProgress = 0;
    this.voidPressure = 0;
    this.riftsStabilized = 0;
    this.voidWarningTier = 0;
    this.rerollsThisRun = 0;
    this.lastRerollAt = -Infinity;
    this.currentUpgradeChoices = [];
    this.health = this.stats.maxHealth;
    this.shield = 0;
    this.score = 0;
    this.ultimate = this.qaMode ? 80 : 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.elapsed = 0;
    this.spawnTimer = this.qaMode ? 0.25 : 1;
    this.shotTimer = 0;
    this.gravityCooldown = 0;
    this.shieldCooldown = 0;
    this.shieldTime = 0;
    this.dashCharges = 2;
    this.dashRecharge = 0;
    this.invulnerable = 0;
    this.bossSpawned = false;
    this.nextEnemyId = 1;
    this.player.position.set(0, 0, 5.2);
    this.aimPoint.set(0, 0, 0);
    this.mouseHeld = false;
    this.touchAttack = false;
    this.touchMove.set(0, 0);
    this.gamepadButtons.clear();
    this.shieldMesh.visible = false;
    this.moveRiftToWave();
    this.applyCharacter();
    this.lastFrameTime = performance.now() / 1000;
    this.pushHud(true);
  }

  private moveRiftToWave() {
    const target = nextRiftPosition(this.wave);
    this.riftTarget.set(target.x, 0, target.z);
    this.rift.position.set(target.x, 1.28, target.z);
    this.riftLight.position.set(target.x, 2.15, target.z);
  }

  private finishRun(
    victory: boolean,
    defeatReason: 'integrity' | 'void' = 'integrity',
  ) {
    if (this.phase !== 'playing') return;
    this.mouseHeld = false;
    this.touchAttack = false;
    const earned = this.qaMode
      ? 0
      : calculateDustReward({
          score: this.score,
          riftsStabilized: this.riftsStabilized,
          victory,
        });
    if (!this.qaMode) {
      this.checkpoint = null;
      this.career.kills += this.kills;
      this.career.rifts += this.riftsStabilized;
      this.career.ultimates += this.runUltimates;
      this.career.bestCombo = Math.max(this.career.bestCombo, this.bestCombo);
      if (
        this.completedCycles > 0 &&
        !this.career.characterWins.includes(this.career.character)
      )
        this.career.characterWins.push(this.career.character);
      if (this.career.mode === 'endless')
        this.career.bestCycle = Math.max(
          this.career.bestCycle,
          this.completedCycles,
        );
      this.newAchievements = awardAchievements(this.career);
      this.career.achievements.push(...this.newAchievements);
      this.career.history.unshift({
        character: this.career.character,
        mode: this.career.mode,
        difficulty: this.career.difficulty,
        score: this.score,
        kills: this.kills,
        rifts: this.riftsStabilized,
        cycles: this.completedCycles,
        level: this.level,
        seconds: Math.floor(this.elapsed),
        victory,
        date: new Date().toISOString(),
      });
      this.career.history = this.career.history.slice(0, 20);
      this.highScore = Math.max(this.highScore, this.score);
      this.runsCompleted += 1;
      if (victory) this.victories += 1;
      this.dust += earned;
      this.saveProgress();
    }
    this.message = victory
      ? `ARCHE SAUVÉE // +${earned} POUSSIÈRES`
      : defeatReason === 'void'
        ? `LE NÉANT A TRAVERSÉ // +${earned} POUSSIÈRES`
        : `TRAME ROMPUE // +${earned} POUSSIÈRES`;
    this.setPhase(victory ? 'victory' : 'gameover');
    this.pushHud(true);
  }

  private clearEntities() {
    this.pickups.forEach(({ mesh }) => {
      this.effectRoot.remove(mesh);
      this.disposeObject(mesh);
    });
    this.pickups = [];
    this.enemies.forEach((enemy) => {
      this.enemyRoot.remove(enemy.group);
      this.disposeObject(enemy.group);
    });
    this.enemies = [];
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      this.removeProjectile(index);
    }
    this.areas.forEach((area) => {
      this.effectRoot.remove(area.mesh);
      area.mesh.geometry.dispose();
      (area.mesh.material as THREE.Material).dispose();
    });
    this.areas = [];
    this.particles.forEach((particle) => {
      this.effectRoot.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      (particle.mesh.material as THREE.Material).dispose();
    });
    this.particles = [];
  }

  private clearHostileProjectiles() {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      if (this.projectiles[index].hostile) this.removeProjectile(index);
    }
  }

  private getNearestEnemy() {
    let nearest: Enemy | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const enemy of this.enemies) {
      const distance = distance2D(enemy.group.position, this.player.position);
      if (distance < nearestDistance) {
        nearest = enemy;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  private showMessage(message: string, duration: number) {
    this.message = message;
    this.messageTimer = duration;
    this.pushHud(true);
  }

  private setPhase(phase: GamePhase) {
    this.phase = phase;
    if (phase !== 'playing') {
      this.touchChannel = false;
      this.keys.clear();
      this.mouseHeld = false;
      this.touchAttack = false;
      this.touchMove.set(0, 0);
    }
    this.callbacks.onPhase(phase);
    this.pushHud(true);
  }

  private pushHud(force = false) {
    if (!force && this.elapsed - this.lastHudPush < 0.08) return;
    this.lastHudPush = this.elapsed;
    const boss = this.enemies.find((enemy) => enemy.kind === 'boss');
    const build = Array.from(this.upgradeRanks.entries()).flatMap(
      ([id, rank]) => {
        const choice = UPGRADE_LIBRARY.find((entry) => entry.id === id);
        return choice ? [{ ...choice, rank }] : [];
      },
    );
    this.callbacks.onHud({
      character: this.career.character,
      mode: this.career.mode,
      difficulty: this.career.difficulty,
      career: this.career,
      cycle: this.cycle,
      level: this.level,
      experience: this.experience,
      nextLevelExperience: experienceForLevel(this.level),
      mana: this.mana,
      maxMana: this.maxMana,
      kills: this.kills,
      bossPhase: boss?.bossPhase ?? 0,
      upgradeReason: this.upgradeReason,
      newAchievements: this.newAchievements,
      qaMode: this.qaMode,
      checkpointCycle: this.checkpoint?.cycle ?? null,
      storageConflict: this.storageConflict,
      health: this.health,
      maxHealth: this.stats.maxHealth,
      shield: this.shield,
      maxShield: this.stats.shieldPower * 1.6,
      score: this.score,
      wave: this.wave,
      riftProgress: this.riftProgress,
      voidPressure: this.voidPressure,
      riftsStabilized: this.riftsStabilized,
      enemies: this.enemies.length,
      ultimate: this.ultimate,
      dashCharges: this.dashCharges,
      gravityCooldown: this.gravityCooldown,
      shieldCooldown: this.shieldCooldown,
      elapsed: this.elapsed,
      highScore: this.highScore,
      dust: this.dust,
      runsCompleted: this.runsCompleted,
      victories: this.victories,
      affinity: this.affinity,
      unlockedAffinities: { ...this.unlockedAffinities },
      storageAvailable: this.storageAvailable,
      upgradeRanks: Object.fromEntries(this.upgradeRanks),
      build,
      rerollCost:
        this.phase === 'upgrade'
          ? recalibrationCost(this.rerollsThisRun)
          : null,
      combo: this.combo,
      bossHealth: boss ? clamp((boss.hp / boss.maxHp) * 100, 0, 100) : null,
      message:
        this.messageTimer > 0 || this.phase !== 'playing' ? this.message : '',
    });
  }

  private loadSave() {
    try {
      const currentRaw = window.localStorage.getItem(PROGRESSION_STORAGE_KEY);
      this.lastSavedRaw = currentRaw;
      const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      const profile = readProgression(currentRaw, legacyRaw);
      this.career = profile.career;
      this.checkpoint = profile.checkpoint;
      if (this.qaMode) this.checkpoint = null;
      this.highScore = profile.highScore;
      this.dust = profile.dust;
      this.muted = profile.muted;
      this.runsCompleted = profile.runsCompleted;
      this.victories = profile.victories;
      this.unlockedAffinities = { ...profile.unlockedAffinities };
      this.affinity = profile.equippedAffinity;
      this.audio.setMuted(this.muted);
      if (!this.qaMode) {
        try {
          const probe = `riftcasters-storage-probe-${Math.random().toString(36).slice(2)}`;
          window.localStorage.setItem(probe, '1');
          window.localStorage.removeItem(probe);
        } catch {
          this.storageAvailable = false;
        }
      }
      if (!isValidCurrentProgression(currentRaw) && legacyRaw) {
        this.saveProgress();
      }
    } catch {
      const profile = createDefaultProfile();
      this.highScore = profile.highScore;
      this.dust = profile.dust;
      this.muted = profile.muted;
      this.runsCompleted = profile.runsCompleted;
      this.victories = profile.victories;
      this.unlockedAffinities = { ...profile.unlockedAffinities };
      this.affinity = profile.equippedAffinity;
      this.storageAvailable = false;
    }
  }

  private saveProgress() {
    if (this.qaMode) return true;
    if (this.storageConflict) return false;
    try {
      if (
        window.localStorage.getItem(PROGRESSION_STORAGE_KEY) !==
        this.lastSavedRaw
      ) {
        this.markStorageConflict();
        return false;
      }
      const raw = this.exportSave();
      window.localStorage.setItem(PROGRESSION_STORAGE_KEY, raw);
      this.lastSavedRaw = raw;
      this.storageAvailable = true;
      return true;
    } catch {
      // Local storage can be unavailable in private browsing; the run remains playable.
      this.storageAvailable = false;
      return false;
    }
  }

  private disposeObject(object: THREE.Object3D) {
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      materials.forEach((material) => material.dispose());
    });
  }
}
