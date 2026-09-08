import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ACHIEVEMENTS, type GameSettings } from '@/lib/game/career';
import {
  CHARACTERS,
  DIFFICULTIES,
  characterById,
  type CharacterId,
  type Difficulty,
  type RunMode,
} from '@/lib/game/content';
import type { HudSnapshot } from '@/lib/game/types';
import type { RiftEngine } from '@/lib/game/RiftEngine';

export function Loadout({
  hud,
  configure,
}: {
  hud: HudSnapshot;
  configure: (id: CharacterId, mode: RunMode, difficulty: Difficulty) => void;
}) {
  const caster = characterById(hud.character);
  return (
    <aside className="loadout-panel" aria-label="Préparer la transmission">
      {hud.checkpointCycle && (
        <p className="journal-notice">
          Endurance sauvegardée au cycle {hud.checkpointCycle}. Reprends puis
          extrais-toi pour commencer une autre transmission.
        </p>
      )}
      <p className="section-kicker">CHOISIR UN RIFTCASTER</p>
      <div className="caster-grid">
        {CHARACTERS.map((entry) => (
          <button
            type="button"
            key={entry.id}
            disabled={hud.checkpointCycle !== null}
            aria-pressed={hud.character === entry.id}
            onClick={() => configure(entry.id, hud.mode, hud.difficulty)}
            style={{ '--caster-color': entry.color } as React.CSSProperties}
          >
            <span className="caster-sigil" aria-hidden="true">
              {entry.id === 'kaela'
                ? '✦'
                : entry.id === 'orin'
                  ? 'ϟ'
                  : entry.id === 'nyx'
                    ? '◉'
                    : '◷'}
            </span>
            <strong>{entry.name}</strong>
            <span>{entry.discipline}</span>
          </button>
        ))}
      </div>
      <div className="caster-detail" style={{ borderColor: caster.color }}>
        <h2>{caster.name}</h2>
        <p>{caster.description}</p>
        <small>
          {caster.health} intégrité · {caster.secondary} · {caster.ultimate}
        </small>
      </div>
      <div className="run-options">
        <label>
          Mission
          <select
            aria-label="Mode de jeu"
            value={hud.mode}
            onChange={(event) =>
              configure(
                hud.character,
                event.target.value as RunMode,
                hud.difficulty,
              )
            }
          >
            <option value="expedition">Expédition — sauver l’Arche</option>
            <option value="endless">Endurance — cycles sans limite</option>
          </select>
        </label>
        <label>
          Difficulté
          <select
            aria-label="Difficulté"
            value={hud.difficulty}
            onChange={(event) =>
              configure(
                hud.character,
                hud.mode,
                event.target.value as Difficulty,
              )
            }
          >
            {Object.entries(DIFFICULTIES).map(([id, entry]) => (
              <option key={id} value={id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="loadout-note">
        {hud.mode === 'endless'
          ? 'Cinq failles puis le Tyran à chaque cycle. Extrais-toi entre deux cycles pour enregistrer le résultat, ou continue avec ton build.'
          : 'Cinq failles à stabiliser, puis le Tyran de la Convergence. La progression de ton build repart à zéro à chaque transmission.'}
      </p>
    </aside>
  );
}

export function CommandCenter({
  hud,
  engine,
  close,
  initialSection = 'guide',
}: {
  hud: HudSnapshot;
  engine: RiftEngine | null;
  close: () => void;
  initialSection?: 'guide' | 'career';
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [section, setSection] = useState<'guide' | 'settings' | 'career'>(
    initialSection,
  );
  const [notice, setNotice] = useState('');
  const [pendingSave, setPendingSave] = useState<string | null>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const update = (settings: Partial<GameSettings>) =>
    engine?.updateSettings(settings);
  const exportSave = () => {
    const raw = engine?.exportSave();
    if (!raw) return;
    const url = URL.createObjectURL(
      new Blob([raw], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'riftcasters-sauvegarde.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Sauvegarde exportée. Conserve ce fichier hors du navigateur.');
  };
  return (
    <dialog
      ref={dialog}
      data-system-dialog
      className="command-dialog"
      aria-labelledby="command-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header>
        <div>
          <p className="section-kicker">L’ARCHE // CENTRE DE TRANSMISSION</p>
          <h2 id="command-title">Journal du Riftcaster</h2>
        </div>
        <Button onClick={close} aria-label="Fermer le journal">
          Fermer
        </Button>
      </header>
      <nav aria-label="Rubriques du journal">
        {(
          [
            ['guide', 'Guide'],
            ['settings', 'Paramètres'],
            ['career', 'Carrière & succès'],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            variant="ghost"
            aria-pressed={section === id}
            onClick={() => setSection(id)}
          >
            {label}
          </Button>
        ))}
      </nav>
      {section === 'guide' && (
        <section className="journal-content">
          <h3>Refermer la Convergence</h3>
          <p>
            Le Tyran relie cinq mondes à l’Arche. Entre dans chaque cercle et
            maintiens E pour le stabiliser. Les ennemis proches ralentissent la
            capture et font monter la pression : à 100 %, l’Arche est perdue.
          </p>
          <p>
            Élimine les anomalies pour gagner de l’expérience. À chaque niveau
            et après chaque faille, choisis une résonance parmi trois. Les
            quinze améliorations atteignent le rang 3 ; une fois toutes
            maîtrisées, les récompenses deviennent du soin, du mana et du score.
          </p>
          <table>
            <caption>Commandes</caption>
            <thead>
              <tr>
                <th>Action</th>
                <th>Clavier / souris</th>
                <th>Manette standard</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Déplacement', 'ZQSD / WASD / flèches', 'Stick gauche'],
                ['Visée / tir', 'Souris / clic gauche', 'Stick droit / RT'],
                ['Arcane secondaire (30 mana)', 'Clic droit / 2', 'LT'],
                ['Canaliser la faille', 'Maintenir E', 'Maintenir RB'],
                ['Égide (20 mana)', 'F', 'LB'],
                ['Esquive', 'Espace', 'A'],
                ['Ultime chargé', 'R', 'Y'],
                ['Pause', 'P / Échap', 'Start'],
                ['Choix de résonance', 'Cliquer ou Tab / Entrée', 'A / X / B'],
              ].map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, i) =>
                    i === 0 ? (
                      <th key={cell}>{cell}</th>
                    ) : (
                      <td key={cell}>{cell}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Tactile : stick de déplacement et visée assistée, bouton de tir à
            maintenir, sorts à toucher, canalisation à maintenir. Les aides de
            visée et de canalisation peuvent aussi être activées dans les
            paramètres.
          </p>
          <p>
            Manette au menu : gauche/droite choisit le Riftcaster, haut/bas
            change de mode, X change la difficulté, Y ouvre le journal. Au camp
            : A continue, B extrait. Au bilan : B revient au menu. Le Tyran
            résiste à la stase : il est ralenti, jamais entièrement figé.
          </p>
          <h3>Lire le champ de bataille</h3>
          <p>
            Cube vert : soin. Cristal bleu : mana. Fragment doré : expérience et
            score. Approche-toi pour les attirer. L’égide renvoie les
            projectiles pendant sa durée active ; l’esquive accorde une brève
            invulnérabilité.
          </p>
          <div className="bestiary-grid">
            {[
              [
                'Traqueur',
                'Poursuite et attaque au contact. Garde une sortie libre.',
              ],
              ['Spectre', 'Orbite à distance et tire des projectiles.'],
              ['Gardien', 'Lent et résistant, dangereux au corps à corps.'],
              [
                'Sangsue',
                'Sabote la capture et soigne le Tyran : cible prioritaire.',
              ],
              ['Artilleur', 'Marque le sol avant une explosion différée.'],
              [
                'Ravageur',
                'S’illumine avant une charge rectiligne : esquive de côté.',
              ],
              [
                'Élite',
                'Couronne blanche, taille et résistance accrues ; certains tirent ou frappent plus fort.',
              ],
              [
                'Tyran',
                'Trois phases irréversibles : salves radiales, invocations, zones de convergence.',
              ],
            ].map(([name, text]) => (
              <article key={name}>
                <h4>{name}</h4>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <h3>Les quatre destinées</h3>
          {CHARACTERS.map((caster) => (
            <p key={caster.id}>
              <strong>{caster.name}.</strong> {caster.lore}
            </p>
          ))}
          <p className="journal-notice">
            Jeu solo local, sans compte ni classement en ligne. Les sauvegardes
            sont propres à ce navigateur et à ce domaine. Les scores ne sont pas
            certifiés anti-triche. Un changement d’onglet met le combat en
            pause.
          </p>
        </section>
      )}
      {section === 'settings' && (
        <section className="journal-content settings-grid">
          <label>
            Qualité graphique
            <select
              value={hud.career.settings.quality}
              onChange={(event) =>
                update({
                  quality: event.target.value as GameSettings['quality'],
                })
              }
            >
              <option value="low">Économie — résolution 1×</option>
              <option value="balanced">Équilibrée — résolution 1,5×</option>
              <option value="high">Haute — résolution 2×</option>
            </select>
          </label>
          <label>
            Volume : {Math.round(hud.career.settings.volume * 100)} %
            <input
              aria-label="Volume général"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={hud.career.settings.volume}
              onChange={(event) =>
                update({ volume: Number(event.target.value) })
              }
            />
          </label>
          {(
            [
              ['reducedMotion', 'Réduire les mouvements et secousses'],
              ['contrast', 'Renforcer le contraste de l’interface'],
              ['autoChannel', 'Canaliser automatiquement dans le cercle'],
              ['autoAim', 'Visée assistée vers la cible la plus proche'],
            ] as const
          ).map(([key, label]) => (
            <label className="check-option" key={key}>
              <input
                type="checkbox"
                checked={hud.career.settings[key]}
                onChange={(event) => update({ [key]: event.target.checked })}
              />
              {label}
            </label>
          ))}
          <p>
            Les préférences de réduction des animations du système sont
            également respectées. Baisse la qualité en cas de ralentissement. Si
            le rendu 3D disparaît, recharge la page ; la progression enregistrée
            reste intacte.
          </p>
        </section>
      )}
      {section === 'career' && (
        <section className="journal-content">
          <h3>{hud.career.achievements.length} / 12 succès</h3>
          <div className="achievement-grid">
            {ACHIEVEMENTS.map((entry) => (
              <article
                key={entry.id}
                data-unlocked={hud.career.achievements.includes(entry.id)}
              >
                <strong>
                  {hud.career.achievements.includes(entry.id) ? '◆' : '◇'}{' '}
                  {entry.title}
                </strong>
                <p>{entry.description}</p>
                {'metric' in entry && (
                  <progress
                    aria-label={entry.title}
                    max={entry.target}
                    value={Math.min(entry.target, hud.career[entry.metric])}
                  />
                )}
              </article>
            ))}
          </div>
          <h3>Dernières transmissions</h3>
          {hud.career.history.length === 0 ? (
            <p>
              Termine une transmission pour inscrire son résultat dans
              l’Archive.
            </p>
          ) : (
            <ol className="run-history">
              {hud.career.history.map((run, index) => (
                <li key={`${run.date}-${index}`}>
                  <strong>
                    {characterById(run.character).name} ·{' '}
                    {run.victory ? 'Extraction réussie' : 'Signal perdu'}
                  </strong>
                  <span>
                    {run.score.toLocaleString('fr-FR')} pts ·{' '}
                    {DIFFICULTIES[run.difficulty].label} ·{' '}
                    {run.mode === 'endless'
                      ? `Endurance C${run.cycles}`
                      : 'Expédition'}{' '}
                    · {run.rifts} failles · Niv. {run.level}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <h3>Protéger la sauvegarde</h3>
          <p>
            Export recommandé avant de changer de navigateur ou de domaine.
            L’import remplace la progression locale ; une copie précédente est
            conservée dans ce navigateur. Les succès sont enregistrés à la fin
            de la transmission.
          </p>
          <div className="save-actions">
            <Button disabled={hud.qaMode} onClick={exportSave}>
              Exporter la sauvegarde
            </Button>
            <label>
              Importer un fichier
              <input
                type="file"
                accept="application/json,.json"
                disabled={hud.qaMode || engine?.getPhase() !== 'menu'}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > 100000) {
                    setNotice('Fichier trop volumineux.');
                    return;
                  }
                  try {
                    setPendingSave(await file.text());
                  } catch {
                    setNotice('Lecture du fichier impossible.');
                  }
                  event.target.value = '';
                }}
              />
            </label>
          </div>
          {pendingSave && (
            <div role="alert" className="import-confirm">
              <p>
                Remplacer la progression locale par ce fichier ? Une sauvegarde
                de secours sera conservée.
              </p>
              <Button
                onClick={() => {
                  const success = engine?.importSave(pendingSave);
                  setNotice(
                    success
                      ? 'Sauvegarde restaurée.'
                      : 'Import refusé : format invalide ou stockage indisponible. Aucune progression valide écrasée.',
                  );
                  setPendingSave(null);
                }}
              >
                Confirmer le remplacement
              </Button>
              <Button variant="ghost" onClick={() => setPendingSave(null)}>
                Annuler
              </Button>
            </div>
          )}
          <output aria-live="polite">{notice}</output>
        </section>
      )}
      <footer className="distribution-links">
        <span>Convergence · candidate de sortie</span>
        {import.meta.env.PROD && location.protocol !== 'file:' && (
          <>
            <a
              href="/RIFTCASTERS_3D_PLAY.bin"
              download="RIFTCASTERS_3D_PLAY.html"
            >
              Télécharger le jeu autonome
            </a>
            <a href="/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">
              Crédits et licences tierces
            </a>
          </>
        )}
      </footer>
    </dialog>
  );
}
