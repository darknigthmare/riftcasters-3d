'use client';

import {
  Crosshair,
  Heart,
  Move,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Button } from '@/components/ui/button';
import type { RiftEngine as RiftEngineType } from '@/lib/game/RiftEngine';
import type {
  AbilityId,
  GamePhase,
  HudSnapshot,
  UpgradeChoice,
} from '@/lib/game/types';

const EMPTY_HUD: HudSnapshot = {
  health: 100,
  maxHealth: 100,
  shield: 0,
  maxShield: 60.8,
  score: 0,
  wave: 1,
  riftProgress: 0,
  enemies: 0,
  ultimate: 0,
  dashCharges: 2,
  gravityCooldown: 0,
  shieldCooldown: 0,
  elapsed: 0,
  highScore: 0,
  dust: 0,
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
  const stickPointerRef = useRef<number | null>(null);
  const webMcpAttemptsRef = useRef(0);
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [hud, setHud] = useState<HudSnapshot>(EMPTY_HUD);
  const [upgrades, setUpgrades] = useState<UpgradeChoice[]>([]);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);
  const [webglError, setWebglError] = useState(false);
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
          },
          onUpgrade: setUpgrades,
        });
        engineRef.current = engine;
        queueMicrotask(() => {
          if (!disposed) {
            setMuted(engine?.getMuted() ?? false);
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
                enemies: current.enemies,
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
      className="rift-game"
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

      <header className="game-brand">
        <span className="brand-mark">
          <Sparkles size={15} />
        </span>
        <span>RIFTCASTERS</span>
        <small>{'// ARCHIVE 07'}</small>
      </header>

      {phase !== 'paused' && phase !== 'upgrade' && (
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

      {phase === 'menu' && (
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
            Trois failles rongent l&apos;Arche. Entre dans l&apos;arène,
            canalise leurs gardiens et empêche le Néant de traverser.
          </p>
          <Button
            className="play-button"
            size="lg"
            type="button"
            data-testid="start-game"
            disabled={!ready || webglError}
            onClick={start}
          >
            <Play fill="currentColor" /> ENTRER DANS LA FAILLE
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
          </div>
        </section>
      )}

      {phase === 'playing' && (
        <>
          <section className="objective-card">
            <span>
              {hud.bossHealth === null
                ? `OBJECTIF // 0${Math.min(3, hud.wave)}`
                : 'MENACE // TITAN'}
            </span>
            <strong>
              {hud.bossHealth === null
                ? 'STABILISER LA FAILLE'
                : 'BRISER LE CŒUR DU TITAN'}
            </strong>
            <progress
              className="rift-progress"
              aria-label={
                hud.bossHealth === null
                  ? 'Stabilisation de la faille'
                  : 'Intégrité du Titan'
              }
              max={100}
              value={Math.round(hud.bossHealth ?? hud.riftProgress)}
            />
          </section>

          <section className="score-stack" data-testid="hud-score">
            <span>SCORE</span>
            <strong>{formatScore(hud.score)}</strong>
            <small>{formatTime(hud.elapsed)}</small>
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
              label="PUITS"
              keyLabel="CLIC D."
              icon={<Orbit />}
              cooldown={hud.gravityCooldown}
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
              keyLabel="E"
              icon={<Shield />}
              cooldown={hud.shieldCooldown}
              onClick={() => cast('shield')}
            />
            <AbilityButton
              label="BRISURE"
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
          <button className="text-action" type="button" onClick={start}>
            <RotateCcw /> RECOMMENCER LA TRANSMISSION
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
            <span>FAILLE STABILISÉE</span>
            <h2 id="upgrade-title">CHOISIS UNE RÉSONANCE</h2>
            <p>Elle façonnera le reste de cette transmission.</p>
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
                  <span className="upgrade-index">0{index + 1}</span>
                  <Icon />
                  <small>{upgrade.school}</small>
                  <strong>{upgrade.title}</strong>
                  <span className="upgrade-description">
                    {upgrade.description}
                  </span>
                  <em>SÉLECTIONNER</em>
                </Button>
              );
            })}
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
          </div>
          <p>{hud.message}</p>
          <Button className="play-button" size="lg" onClick={start}>
            <RotateCcw /> NOUVELLE TRANSMISSION
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
  onClick,
}: {
  label: string;
  keyLabel: string;
  icon: React.ReactNode;
  cooldown?: number;
  charges?: number;
  meter?: number;
  onClick: () => void;
}) {
  const disabled = cooldown > 0 || (charges !== undefined && charges <= 0);
  return (
    <Button
      variant="ghost"
      className="ability-slot"
      type="button"
      disabled={disabled}
      aria-label={`${label}${cooldown > 0 ? `, recharge ${Math.ceil(cooldown)} secondes` : ''}`}
      onClick={onClick}
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
