'use client';

import {
  Crosshair,
  Flame,
  Gem,
  Heart,
  Move,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  RefreshCw,
  Shield,
  Sparkles,
  Volume2,
  VolumeX,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Button } from '@/components/ui/button';
import { CommandCenter, Loadout } from './CommandCenter';
import { OfflineStatus } from './OfflineStatus';
import { ACHIEVEMENTS, defaultCareer } from '@/lib/game/career';
import {
  RIFTS_PER_CYCLE,
  RIFT_CHAPTERS,
  characterById,
  isBossWave,
} from '@/lib/game/content';
import { affinityUnlockCost, recalibrationCost } from '@/lib/game/progression';
import type { RiftEngine as RiftEngineType } from '@/lib/game/RiftEngine';
import type {
  AbilityId,
  AffinityId,
  GamePhase,
  HudSnapshot,
  UpgradeChoice,
} from '@/lib/game/types';

const EMPTY_HUD: HudSnapshot = {
  character: 'kaela',
  mode: 'expedition',
  difficulty: 'standard',
  career: defaultCareer(),
  cycle: 1,
  level: 1,
  experience: 0,
  nextLevelExperience: 45,
  mana: 100,
  maxMana: 100,
  kills: 0,
  bossPhase: 0,
  upgradeReason: 'rift',
  newAchievements: [],
  qaMode: false,
  checkpointCycle: null,
  storageConflict: false,
  health: 100,
  maxHealth: 100,
  shield: 0,
  maxShield: 60.8,
  score: 0,
  wave: 1,
  riftProgress: 0,
  voidPressure: 0,
  riftsStabilized: 0,
  enemies: 0,
  ultimate: 0,
  dashCharges: 2,
  gravityCooldown: 0,
  shieldCooldown: 0,
  elapsed: 0,
  highScore: 0,
  dust: 0,
  runsCompleted: 0,
  victories: 0,
  affinity: 'none',
  unlockedAffinities: {
    braise: false,
    prisme: false,
    neant: false,
  },
  storageAvailable: true,
  upgradeRanks: {},
  build: [],
  rerollCost: null,
  combo: 0,
  bossHealth: null,
  message: 'Entre dans la faille',
};

const UPGRADE_ICONS = {
  bolt: Zap,
  shield: Shield,
  void: Orbit,
  heart: Heart,
  dash: Wind,
};

const AFFINITIES = [
  {
    id: 'braise',
    school: 'BRAISE',
    title: 'Serment incandescent',
    description:
      'Garantit une résonance de Braise dans chaque sélection de la transmission.',
    icon: Flame,
  },
  {
    id: 'prisme',
    school: 'PRISME',
    title: 'Serment prismatique',
    description:
      'Garantit une résonance de Prisme dans chaque sélection de la transmission.',
    icon: Shield,
  },
  {
    id: 'neant',
    school: 'NÉANT',
    title: 'Serment abyssal',
    description:
      'Garantit une résonance du Néant dans chaque sélection de la transmission.',
    icon: Orbit,
  },
] satisfies Array<{
  id: AffinityId;
  school: string;
  title: string;
  description: string;
  icon: typeof Flame;
}>;

const AFFINITY_LABELS = {
  none: 'AUCUNE',
  braise: 'BRAISE',
  prisme: 'PRISME',
  neant: 'NÉANT',
};

function formatScore(score: number) {
  return Math.floor(score).toLocaleString('fr-FR').padStart(5, '0');
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

export function RiftcastersExperience() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RiftEngineType | null>(null);
  const phaseRef = useRef<GamePhase>('menu');
  const hudRef = useRef<HudSnapshot>(EMPTY_HUD);
  const stickRef = useRef<HTMLDivElement>(null);
  const upgradeDialogRef = useRef<HTMLDialogElement>(null);
  const archiveDialogRef = useRef<HTMLDialogElement>(null);
  const archiveWasOpenRef = useRef(false);
  const stickPointerRef = useRef<number | null>(null);
  const webMcpAttemptsRef = useRef(0);
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [hud, setHud] = useState<HudSnapshot>(EMPTY_HUD);
  const [upgrades, setUpgrades] = useState<UpgradeChoice[]>([]);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);
  const [webglError, setWebglError] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [engineApi, setEngineApi] = useState<RiftEngineType | null>(null);
  const [stickPosition, setStickPosition] = useState({ x: 0, y: 0 });
  const [webMcpEpoch, setWebMcpEpoch] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let engine: RiftEngineType | null = null;
    void import('@/lib/game/RiftEngine')
      .then(({ RiftEngine }) => {
        if (disposed) return;
        engine = new RiftEngine(canvas, {
          onHud: setHud,
          onPhase: (nextPhase) => {
            phaseRef.current = nextPhase;
            setPhase(nextPhase);
            if (nextPhase !== 'playing') {
              stickPointerRef.current = null;
              setStickPosition({ x: 0, y: 0 });
            }
            if (nextPhase !== 'menu') setArchiveOpen(false);
          },
          onUpgrade: setUpgrades,
        });
        engineRef.current = engine;
        queueMicrotask(() => {
          if (!disposed) {
            setMuted(engine?.getMuted() ?? false);
            setEngineApi(engine);
            setReady(true);
          }
        });
      })
      .catch((error: unknown) => {
        console.error('RIFTCASTERS WebGL initialization failed', error);
        queueMicrotask(() => {
          if (!disposed) setWebglError(true);
        });
      });
    return () => {
      disposed = true;
      engine?.dispose();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    phaseRef.current = phase;
    if (phase === 'upgrade') {
      queueMicrotask(() => {
        upgradeDialogRef.current
          ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
          ?.focus();
      });
    }
  }, [phase]);

  useEffect(() => {
    if (!archiveOpen) {
      if (archiveWasOpenRef.current) {
        archiveWasOpenRef.current = false;
        queueMicrotask(() => {
          document
            .querySelector<HTMLButtonElement>('[data-archive-trigger]')
            ?.focus();
        });
      }
      return;
    }
    archiveWasOpenRef.current = true;
    queueMicrotask(() => {
      archiveDialogRef.current
        ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
        ?.focus();
    });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.code !== 'Escape') return;
      event.preventDefault();
      setArchiveOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [archiveOpen]);

  useEffect(() => {
    hudRef.current = hud;
  }, [hud]);

  useEffect(() => {
    if (!ready) return;
    const context = document.modelContext;
    if (!context?.registerTool) {
      if (webMcpAttemptsRef.current >= 20) return;
      webMcpAttemptsRef.current += 1;
      const retry = window.setTimeout(
        () => setWebMcpEpoch((value) => value + 1),
        250,
      );
      return () => window.clearTimeout(retry);
    }
    webMcpAttemptsRef.current = 0;
    const lifecycle = new AbortController();
    const requireEmptyObject = (input: unknown) => {
      if (
        input !== undefined &&
        (typeof input !== 'object' ||
          input === null ||
          Array.isArray(input) ||
          Object.keys(input).length > 0)
      ) {
        throw new Error('Cette action ne prend aucun paramètre.');
      }
    };
    try {
      const registrations = [
        context.registerTool(
          {
            name: 'start_riftcasters_run',
            title: 'Démarrer une transmission RIFTCASTERS',
            description:
              'Démarre immédiatement une nouvelle partie visible de RIFTCASTERS.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: {
              readOnlyHint: false,
              untrustedContentHint: false,
            },
            execute(input) {
              requireEmptyObject(input);
              const engine = engineRef.current;
              if (!engine) throw new Error('Le moteur 3D n’est pas prêt.');
              engine.start();
              return { gameState: engine.getPhase(), wave: 1 };
            },
          },
          { signal: lifecycle.signal },
        ),
        context.registerTool(
          {
            name: 'read_riftcasters_status',
            title: 'Lire l’état de RIFTCASTERS',
            description:
              'Lit l’état visible de la partie, le score, la vague et l’intégrité sans modifier le jeu.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: {
              readOnlyHint: true,
              untrustedContentHint: false,
            },
            execute(input) {
              requireEmptyObject(input);
              const current = hudRef.current;
              return {
                gameState: phaseRef.current,
                wave: current.wave,
                score: current.score,
                health: Math.ceil(current.health),
                riftProgress: Math.floor(current.riftProgress),
                voidPressure: Math.ceil(current.voidPressure),
                riftsStabilized: current.riftsStabilized,
                enemies: current.enemies,
                dust: current.dust,
                affinity: current.affinity,
              };
            },
          },
          { signal: lifecycle.signal },
        ),
        context.registerTool(
          {
            name: 'configure_riftcasters_affinity',
            title: 'Configurer l’affinité RIFTCASTERS',
            description:
              'Depuis l’Arche, débloque puis équipe une affinité de Braise, Prisme ou Néant, ou revient à une trame neutre.',
            inputSchema: {
              type: 'object',
              properties: {
                affinity: {
                  type: 'string',
                  enum: ['none', 'braise', 'prisme', 'neant'],
                },
              },
              required: ['affinity'],
              additionalProperties: false,
            },
            annotations: {
              readOnlyHint: false,
              untrustedContentHint: false,
            },
            execute(input) {
              const affinity =
                input && typeof input === 'object' && !Array.isArray(input)
                  ? (input as { affinity?: unknown }).affinity
                  : undefined;
              if (
                affinity !== 'none' &&
                affinity !== 'braise' &&
                affinity !== 'prisme' &&
                affinity !== 'neant'
              ) {
                throw new Error('Affinité invalide.');
              }
              const engine = engineRef.current;
              if (!engine) throw new Error('Le moteur 3D n’est pas prêt.');
              return engine.setAffinity(affinity);
            },
          },
          { signal: lifecycle.signal },
        ),
        context.registerTool(
          {
            name: 'reroll_riftcasters_resonances',
            title: 'Recalibrer les résonances RIFTCASTERS',
            description:
              'Pendant un choix de résonance, dépense la poussière requise pour générer trois nouvelles offres.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: {
              readOnlyHint: false,
              untrustedContentHint: false,
            },
            execute(input) {
              requireEmptyObject(input);
              const engine = engineRef.current;
              if (!engine) throw new Error('Le moteur 3D n’est pas prêt.');
              const success = engine.rerollUpgrades();
              return {
                success,
                ...engine.getProgression(),
                gameState: engine.getPhase(),
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ];
      void Promise.all(
        registrations.map((entry) => Promise.resolve(entry)),
      ).catch((error: unknown) =>
        console.warn('WebMCP registration failed', error),
      );
    } catch (error) {
      console.warn('WebMCP registration failed', error);
    }
    return () => lifecycle.abort();
  }, [ready, webMcpEpoch]);

  const start = () => engineRef.current?.start();
  const togglePause = () => engineRef.current?.togglePause();
  const cast = (ability: AbilityId) =>
    engineRef.current?.triggerAbility(ability);

  const moveStick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (stickPointerRef.current !== event.pointerId) return;
    const bounds = stickRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const x = event.clientX - (bounds.left + bounds.width / 2);
    const y = event.clientY - (bounds.top + bounds.height / 2);
    const limit = bounds.width * 0.34;
    const length = Math.hypot(x, y);
    const scale = length > limit ? limit / length : 1;
    const next = { x: x * scale, y: y * scale };
    setStickPosition(next);
    engineRef.current?.setTouchMove(next.x / limit, next.y / limit);
  };

  const onStickDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    stickPointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    moveStick(event);
  };

  const releaseStick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (stickPointerRef.current !== event.pointerId) return;
    stickPointerRef.current = null;
    setStickPosition({ x: 0, y: 0 });
    engineRef.current?.setTouchMove(0, 0);
  };

  const setTouchAttack = (active: boolean) =>
    engineRef.current?.setTouchAttack(active);

  return (
    <main
      className={`rift-game${hud.career.settings.contrast ? ' high-contrast' : ''}${hud.career.settings.reducedMotion ? ' reduced-motion' : ''}`}
      data-testid="riftcasters-game"
      data-game-state={phase}
      data-game-ready={ready}
      data-webgl-error={webglError}
    >
      <canvas
        ref={canvasRef}
        className="game-canvas"
        data-testid="game-canvas"
        aria-label="Arène tridimensionnelle de RIFTCASTERS"
      />
      <div className="scanlines" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <OfflineStatus phase={phase} />
      {hud.storageConflict && (
        <div className="storage-conflict" role="alert">
          Un autre onglet a modifié la sauvegarde. Les écritures sont
          suspendues. Exporte cette session dans le journal, puis recharge pour
          retrouver la progression la plus récente.
        </div>
      )}

      <header className="game-brand">
        <span className="brand-mark">
          <Sparkles size={15} />
        </span>
        <span>RIFTCASTERS</span>
        <small>
          {hud.qaMode ? '// TEST — SANS SAUVEGARDE' : '// CONVERGENCE'}
        </small>
      </header>

      {phase !== 'paused' && phase !== 'upgrade' && !archiveOpen && (
        <div className="top-actions">
          {phase === 'playing' && (
            <Button
              variant="ghost"
              size="icon-lg"
              className="hud-icon-button"
              type="button"
              aria-label="Mettre en pause"
              onClick={togglePause}
            >
              <Pause />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-lg"
            className="hud-icon-button"
            type="button"
            disabled={!ready}
            aria-label={muted ? 'Activer le son' : 'Couper le son'}
            aria-pressed={muted}
            onClick={() => setMuted((value) => !value)}
          >
            {muted ? <VolumeX /> : <Volume2 />}
          </Button>
        </div>
      )}

      {phase === 'menu' && !archiveOpen && (
        <div className="menu-layout">
          <section className="start-panel" aria-labelledby="game-title">
            <div className="eyebrow">
              <span /> TRANSMISSION INSTABLE
            </div>
            <h1 id="game-title">
              RIFT
              <br />
              <em>CASTERS</em>
            </h1>
            <p className="game-premise">
              Cinq failles rongent l&apos;Arche. Entre dans l&apos;arène,
              maintiens E dans leurs cercles et empêche le Néant de traverser.
              Élimine les contestataires avant que sa pression atteigne
              100&nbsp;%.
            </p>
            <Button
              className="play-button"
              size="lg"
              type="button"
              data-testid="start-game"
              disabled={!ready || webglError}
              onClick={start}
            >
              <Play fill="currentColor" />{' '}
              {hud.checkpointCycle
                ? `REPRENDRE — CYCLE ${hud.checkpointCycle}`
                : 'ENTRER DANS LA FAILLE'}
            </Button>
            <div className="menu-meta">
              <span>
                <Move /> ZQSD / WASD
              </span>
              <span>
                <Crosshair /> SOURIS POUR VISER
              </span>
              <span>
                <Wind /> ESPACE POUR ESQUIVER
              </span>
            </div>
            <div className="legacy-stats" aria-label="Progression sauvegardée">
              <span>
                MEILLEUR SCORE <strong>{formatScore(hud.highScore)}</strong>
              </span>
              <span>
                POUSSIÈRE D&apos;ÉTHER <strong>{hud.dust}</strong>
              </span>
              <span>
                TRANSMISSIONS <strong>{hud.runsCompleted}</strong>
              </span>
              <span>
                VICTOIRES <strong>{hud.victories}</strong>
              </span>
              <span>
                AFFINITÉ <strong>{AFFINITY_LABELS[hud.affinity]}</strong>
              </span>
            </div>
            <Button
              variant="ghost"
              className="archive-trigger"
              data-archive-trigger
              type="button"
              onClick={() => setArchiveOpen(true)}
            >
              <Gem /> OUVRIR L&apos;ARCHIVE DE L&apos;ARCHE
            </Button>
            <Button
              variant="ghost"
              className="archive-trigger"
              data-journal-trigger
              onClick={() => setJournalOpen(true)}
            >
              GUIDE · PARAMÈTRES · SUCCÈS
            </Button>
            {!hud.storageAvailable && (
              <output className="storage-warning">
                Sauvegarde indisponible : progression limitée à cette session.
              </output>
            )}
          </section>
          <Loadout
            hud={hud}
            configure={(character, mode, difficulty) =>
              engineRef.current?.configureRun(character, mode, difficulty)
            }
          />
        </div>
      )}
      {journalOpen && (
        <CommandCenter
          hud={hud}
          engine={engineApi}
          initialSection={
            phase === 'victory' || phase === 'gameover' ? 'career' : 'guide'
          }
          close={() => {
            setJournalOpen(false);
            setMuted(engineRef.current?.getMuted() ?? false);
          }}
        />
      )}

      {phase === 'menu' && archiveOpen && (
        <dialog
          ref={archiveDialogRef}
          open
          className="archive-overlay"
          aria-modal="true"
          aria-labelledby="archive-title"
          aria-describedby="archive-description"
          onCancel={(event) => {
            event.preventDefault();
            setArchiveOpen(false);
          }}
        >
          <section className="archive-panel">
            <Button
              variant="ghost"
              size="icon-lg"
              className="archive-close"
              type="button"
              aria-label="Fermer l’Archive de l’Arche"
              onClick={() => setArchiveOpen(false)}
            >
              <X />
            </Button>
            <div className="archive-heading">
              <span className="modal-eyebrow">MÉTA-PROGRESSION</span>
              <h2 id="archive-title">ARCHIVE DE L&apos;ARCHE</h2>
              <p id="archive-description">
                Débloque un serment avec la poussière gagnée en mission. Une
                seule affinité peut guider tes choix de résonance.
              </p>
            </div>
            <div className="archive-wallet" aria-label="Poussière disponible">
              <Gem />
              <span>POUSSIÈRE DISPONIBLE</span>
              <strong>{hud.dust}</strong>
            </div>
            {!hud.storageAvailable && (
              <output className="storage-warning archive-storage-warning">
                Sauvegarde indisponible : achats et recalibrages sont suspendus.
              </output>
            )}
            <div className="affinity-grid">
              {AFFINITIES.map((entry) => {
                const Icon = entry.icon;
                const unlocked = hud.unlockedAffinities[entry.id];
                const active = hud.affinity === entry.id;
                const cost = affinityUnlockCost(entry.id);
                return (
                  <Button
                    key={entry.id}
                    variant="ghost"
                    className={`affinity-card affinity-${entry.id}${active ? ' is-active' : ''}`}
                    type="button"
                    disabled={
                      !hud.storageAvailable ||
                      active ||
                      (!unlocked && hud.dust < cost)
                    }
                    aria-label={`${entry.title}. ${
                      active
                        ? 'Affinité active'
                        : unlocked
                          ? 'Équiper'
                          : `Débloquer pour ${cost} poussières`
                    }`}
                    onClick={() => engineRef.current?.setAffinity(entry.id)}
                  >
                    <span className="affinity-icon">
                      <Icon />
                    </span>
                    <small>{entry.school}</small>
                    <strong>{entry.title}</strong>
                    <span>{entry.description}</span>
                    <em>
                      {active
                        ? 'ACCORDÉE'
                        : unlocked
                          ? 'ACCORDER'
                          : `DÉBLOQUER // ${cost} ✦`}
                    </em>
                  </Button>
                );
              })}
            </div>
            <div className="archive-footer">
              <p>
                Les affinités orientent les choix sans augmenter directement les
                dégâts : chaque victoire reste fondée sur ton build.
              </p>
              {hud.affinity !== 'none' && (
                <button
                  className="text-action"
                  type="button"
                  disabled={!hud.storageAvailable}
                  onClick={() => engineRef.current?.setAffinity('none')}
                >
                  DÉSACCORDER L&apos;AFFINITÉ
                </button>
              )}
            </div>
          </section>
        </dialog>
      )}

      {phase === 'playing' && (
        <>
          <section className="objective-card">
            <span>
              {hud.bossHealth === null
                ? `FAILLE ${Math.min(RIFTS_PER_CYCLE, hud.wave)}/${RIFTS_PER_CYCLE} // ${RIFT_CHAPTERS[Math.min(4, hud.wave - 1)].name}`
                : `TYRAN // PHASE ${hud.bossPhase}`}
            </span>
            <strong>
              {hud.bossHealth === null
                ? hud.career.settings.autoChannel
                  ? 'RESTER DANS LE CERCLE'
                  : 'MAINTENIR E DANS LE CERCLE'
                : 'BRISER LA CONVERGENCE'}
            </strong>
            <progress
              className="rift-progress"
              aria-label={
                hud.bossHealth === null
                  ? 'Stabilisation de la faille'
                  : 'Intégrité du Tyran'
              }
              max={100}
              value={Math.round(hud.bossHealth ?? hud.riftProgress)}
            />
            {hud.bossHealth === null && (
              <div
                className={`void-pressure${hud.voidPressure >= 75 ? ' is-critical' : ''}`}
              >
                <span>PRESSION DU NÉANT</span>
                <strong>{Math.ceil(hud.voidPressure)}%</strong>
                <progress
                  aria-label="Pression du Néant sur l’Arche"
                  max={100}
                  value={Math.round(hud.voidPressure)}
                />
              </div>
            )}
          </section>

          <section className="score-stack" data-testid="hud-score">
            <span>SCORE</span>
            <strong>{formatScore(hud.score)}</strong>
            <small>{formatTime(hud.elapsed)}</small>
            <small>
              {characterById(hud.character).name} · C{hud.cycle} · Niv.{' '}
              {hud.level}
            </small>
            <progress
              className="xp-track"
              aria-label="Expérience du niveau"
              max={hud.nextLevelExperience}
              value={hud.experience}
            />
          </section>

          <section className="hud-vitals" data-testid="hud-health">
            <div className="vital-label">
              <span>INTÉGRITÉ</span>
              <strong>{Math.ceil(hud.health)}</strong>
            </div>
            <progress
              className="health-track"
              aria-label="Intégrité du Riftcaster"
              max={Math.round(hud.maxHealth)}
              value={Math.round(hud.health)}
            />
            <progress
              className="shield-track"
              aria-label="Charge de l’égide"
              max={Math.round(hud.maxShield)}
              value={Math.round(hud.shield)}
            />
            <div className="mana-label">
              MANA{' '}
              <strong>
                {Math.floor(hud.mana)} / {hud.maxMana}
              </strong>
            </div>
            <progress
              className="mana-track"
              aria-label="Mana"
              max={hud.maxMana}
              value={hud.mana}
            />
          </section>

          <section className="combat-readout">
            <div className="wave-readout" data-testid="hud-wave">
              <span>VAGUE</span>
              <strong>{String(hud.wave).padStart(2, '0')}</strong>
            </div>
            <div className="enemy-counter">
              <span>ANOMALIES</span>
              <strong>{String(hud.enemies).padStart(2, '0')}</strong>
            </div>
          </section>

          <section className="spell-deck" aria-label="Sorts disponibles">
            <AbilityButton
              label={characterById(hud.character).secondary}
              keyLabel="2 / CLIC D."
              icon={<Orbit />}
              cooldown={hud.gravityCooldown}
              resourceReady={hud.mana >= 30}
              onClick={() => cast('gravity')}
            />
            <AbilityButton
              label="ESQUIVE"
              keyLabel="ESPACE"
              icon={<Wind />}
              charges={hud.dashCharges}
              onClick={() => cast('dash')}
            />
            <AbilityButton
              label="ÉGIDE"
              keyLabel="F"
              icon={<Shield />}
              cooldown={hud.shieldCooldown}
              resourceReady={hud.mana >= 20}
              onClick={() => cast('shield')}
            />
            <AbilityButton
              label={characterById(hud.character).ultimate}
              keyLabel="R"
              icon={<Zap />}
              meter={hud.ultimate}
              onClick={() => cast('ultimate')}
            />
          </section>

          {hud.combo > 1 && (
            <div className="combo-badge">
              <span>RÉSONANCE</span>
              <strong>×{hud.combo}</strong>
            </div>
          )}
        </>
      )}

      {phase === 'playing' && (
        <div className="touch-controls" aria-label="Contrôles tactiles">
          {!isBossWave(hud.wave) && (
            <button
              className="touch-channel"
              type="button"
              aria-label="Maintenir pour canaliser la faille"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                engineRef.current?.setChannel(true);
              }}
              onPointerUp={() => engineRef.current?.setChannel(false)}
              onPointerCancel={() => engineRef.current?.setChannel(false)}
            >
              MAINTENIR
              <br />
              CANALISER
            </button>
          )}
          <div
            ref={stickRef}
            className="touch-stick"
            role="presentation"
            onPointerDown={onStickDown}
            onPointerMove={moveStick}
            onPointerUp={releaseStick}
            onPointerCancel={releaseStick}
          >
            <i
              style={{
                transform: `translate(${stickPosition.x}px, ${stickPosition.y}px)`,
              }}
            />
          </div>
          <Button
            className="touch-fire"
            type="button"
            aria-label="Maintenir pour lancer des traits arcaniques"
            onPointerDown={() => setTouchAttack(true)}
            onPointerUp={() => setTouchAttack(false)}
            onPointerCancel={() => setTouchAttack(false)}
            onPointerLeave={() => setTouchAttack(false)}
            onClick={() => engineRef.current?.triggerPrimary()}
          >
            <Crosshair />
          </Button>
        </div>
      )}

      <output
        className={`combat-message${hud.message && phase === 'playing' ? ' is-visible' : ''}`}
        aria-live="polite"
      >
        <span /> {phase === 'playing' ? hud.message : ''} <span />
      </output>

      {phase === 'paused' && (
        <OverlayPanel eyebrow="SUSPENSION TACTIQUE" title="PAUSE">
          <p>La trame est figée. Reprends quand tu es prêt.</p>
          <Button className="play-button" size="lg" onClick={togglePause}>
            <Play fill="currentColor" /> REPRENDRE
          </Button>
          <Button variant="ghost" onClick={() => setJournalOpen(true)}>
            GUIDE ET PARAMÈTRES
          </Button>
          <button
            className="text-action"
            type="button"
            onClick={() => engineRef.current?.abandonRun()}
          >
            TERMINER LA TRANSMISSION ET VOIR LE BILAN
          </button>
        </OverlayPanel>
      )}

      {phase === 'upgrade' && (
        <dialog
          ref={upgradeDialogRef}
          open
          className="upgrade-overlay"
          aria-modal="true"
          aria-labelledby="upgrade-title"
        >
          <div className="upgrade-heading">
            <span>
              {hud.upgradeReason === 'level'
                ? `NIVEAU ${hud.level} ATTEINT`
                : 'FAILLE STABILISÉE'}
            </span>
            <h2 id="upgrade-title">CHOISIS UNE RÉSONANCE</h2>
            <p>
              Elle façonnera le reste de cette transmission. Affinité&nbsp;:{' '}
              <strong>{AFFINITY_LABELS[hud.affinity]}</strong>
            </p>
          </div>
          <div className="upgrade-grid">
            {upgrades.map((upgrade, index) => {
              const Icon = UPGRADE_ICONS[upgrade.icon];
              return (
                <Button
                  key={upgrade.id}
                  variant="ghost"
                  className={`upgrade-card school-${upgrade.school.toLowerCase().replace('é', 'e')}`}
                  onClick={() => engineRef.current?.chooseUpgrade(upgrade.id)}
                >
                  <span className="upgrade-index">
                    0{index + 1} · {['A', 'X', 'B'][index]}
                  </span>
                  <Icon />
                  <small>{`${upgrade.school} // RANG ${(hud.upgradeRanks[upgrade.id] ?? 0) + 1}`}</small>
                  <strong>{upgrade.title}</strong>
                  <span className="upgrade-description">
                    {upgrade.description}
                  </span>
                  <em>SÉLECTIONNER</em>
                </Button>
              );
            })}
          </div>
          <div className="upgrade-actions">
            <Button
              variant="ghost"
              className="reroll-button"
              type="button"
              disabled={
                !hud.storageAvailable ||
                hud.dust < (hud.rerollCost ?? recalibrationCost(0))
              }
              onClick={() => engineRef.current?.rerollUpgrades()}
            >
              <RefreshCw />
              RECALIBRER // {hud.rerollCost ?? recalibrationCost(0)} ✦
            </Button>
            <span>{hud.dust} POUSSIÈRES DISPONIBLES</span>
            {!hud.storageAvailable && (
              <output className="storage-warning upgrade-storage-warning">
                Recalibrage suspendu : sauvegarde indisponible.
              </output>
            )}
          </div>
        </dialog>
      )}

      {(phase === 'gameover' || phase === 'victory') && (
        <OverlayPanel
          eyebrow={phase === 'victory' ? 'TRAME STABILISÉE' : 'SIGNAL PERDU'}
          title={phase === 'victory' ? 'ARCHE SAUVÉE' : 'RIFTCASTER TOMBÉ'}
          victory={phase === 'victory'}
        >
          <div className="result-grid">
            <span>
              SCORE <strong>{formatScore(hud.score)}</strong>
            </span>
            <span>
              VAGUE <strong>{hud.wave}</strong>
            </span>
            <span>
              DURÉE <strong>{formatTime(hud.elapsed)}</strong>
            </span>
            <span>
              FAILLES{' '}
              <strong>
                {hud.riftsStabilized}
                {hud.mode === 'expedition' ? `/${RIFTS_PER_CYCLE}` : ''}
              </strong>
            </span>
          </div>
          {hud.build.length > 0 && (
            <div className="result-build" aria-label="Build de la transmission">
              <span>RÉSONANCES</span>
              <div>
                {hud.build.map((entry) => (
                  <small
                    key={entry.id}
                    className={`school-${entry.school.toLowerCase().replace('é', 'e')}`}
                  >
                    {entry.title} · R{entry.rank}
                  </small>
                ))}
              </div>
            </div>
          )}
          <p>{hud.message}</p>
          {!hud.storageAvailable && (
            <p className="storage-warning">
              RÉSULTAT NON ENREGISTRÉ. Ne ferme pas cette page avant d’avoir
              exporté la progression. L’extraction ne répare pas un stockage
              bloqué.
            </p>
          )}
          <Button variant="ghost" onClick={() => setJournalOpen(true)}>
            CARRIÈRE · SAUVEGARDE · EXPORT
          </Button>
          {!hud.storageAvailable && !hud.storageConflict && (
            <Button
              variant="ghost"
              onClick={() => engineRef.current?.retrySave()}
            >
              RÉESSAYER LA SAUVEGARDE
            </Button>
          )}
          {hud.newAchievements.length > 0 && (
            <p className="unlocked-notice">
              SUCCÈS :{' '}
              {hud.newAchievements
                .map(
                  (id) => ACHIEVEMENTS.find((entry) => entry.id === id)?.title,
                )
                .join(' · ')}
            </p>
          )}
          <Button className="play-button" size="lg" onClick={start}>
            <RotateCcw /> NOUVELLE TRANSMISSION
          </Button>
          <button
            className="text-action"
            type="button"
            onClick={() => engineRef.current?.returnToMenu()}
          >
            <Gem /> RETOUR À L&apos;ARCHE
          </button>
        </OverlayPanel>
      )}

      {phase === 'camp' && (
        <OverlayPanel
          eyebrow={`ENDURANCE // CYCLE ${hud.cycle} TERMINÉ`}
          title="UN INSTANT DE RÉPIT"
          victory
        >
          <p>
            Le Tyran est tombé. Extrais-toi pour enregistrer la victoire ou
            continue avec ton build et toutes tes ressources restaurées.{' '}
            {hud.qaMode
              ? 'Mode test : aucun point de reprise écrit.'
              : hud.storageAvailable
                ? 'Point de reprise enregistré ici : tu peux fermer puis reprendre au camp.'
                : 'Stockage indisponible : extrais-toi puis exporte la progression depuis le bilan avant de fermer.'}
          </p>
          <p>
            {formatScore(hud.score)} points · {hud.kills} anomalies · Niveau{' '}
            {hud.level}
          </p>
          <Button
            className="play-button"
            onClick={() => engineRef.current?.continueEndurance()}
          >
            CONTINUER — CYCLE {hud.cycle + 1}
          </Button>
          <Button
            variant="ghost"
            onClick={() => engineRef.current?.extractRun()}
          >
            EXTRAIRE ET ENREGISTRER LA VICTOIRE
          </Button>
        </OverlayPanel>
      )}

      {webglError && (
        <div className="webgl-fallback" role="alert">
          Le moteur 3D n&apos;a pas pu démarrer. Active WebGL dans ton
          navigateur puis recharge la page.
        </div>
      )}
    </main>
  );
}

function AbilityButton({
  label,
  keyLabel,
  icon,
  cooldown = 0,
  charges,
  meter,
  resourceReady = true,
  onClick,
}: {
  label: string;
  keyLabel: string;
  icon: React.ReactNode;
  cooldown?: number;
  charges?: number;
  meter?: number;
  resourceReady?: boolean;
  onClick: () => void;
}) {
  const disabled =
    !resourceReady ||
    cooldown > 0 ||
    (charges !== undefined && charges <= 0) ||
    (meter !== undefined && meter < 100);
  return (
    <Button
      variant="ghost"
      className="ability-slot"
      type="button"
      disabled={disabled}
      aria-label={`${label}${cooldown > 0 ? `, recharge ${Math.ceil(cooldown)} secondes` : ''}`}
      onClick={onClick}
      onPointerUp={(event) => event.currentTarget.blur()}
    >
      <kbd>{keyLabel}</kbd>
      <i>{icon}</i>
      <span>{label}</span>
      {cooldown > 0 && <b>{Math.ceil(cooldown)}</b>}
      {charges !== undefined && (
        <small>
          {'◆'.repeat(charges)}
          {'◇'.repeat(2 - charges)}
        </small>
      )}
      {meter !== undefined && (
        <em style={{ '--meter': `${meter}%` } as React.CSSProperties} />
      )}
    </Button>
  );
}

function OverlayPanel({
  eyebrow,
  title,
  victory = false,
  children,
}: {
  eyebrow: string;
  title: string;
  victory?: boolean;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    queueMicrotask(() => {
      dialogRef.current
        ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
        ?.focus();
    });
  }, []);

  return (
    <dialog
      ref={dialogRef}
      open
      className={`modal-overlay${victory ? ' victory' : ''}`}
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal-panel">
        <span className="modal-eyebrow">{eyebrow}</span>
        <h2 id="modal-title">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
