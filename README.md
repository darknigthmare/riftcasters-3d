# RIFTCASTERS 3D — Convergence

Arena-survivor 3D solo, en français, jouable dans un navigateur avec WebGL2. Sauvez l’Arche : stabilisez cinq failles puis affrontez le Tyran de la Convergence à trois phases. Quatre disciplines, quinze améliorations de rang 1 à 3 et douze succès permettent de varier les builds.

Version candidate : le contenu est développé et soumis aux contrôles techniques ; les conditions d’une sortie commerciale sont suivies séparément dans [RELEASE-GATES](docs/RELEASE-GATES.md). Aucun multijoueur, compte, achat intégré ou classement serveur n’est annoncé.

## Jouer

Le menu permet de choisir Kaela Voss (feu), Orin Vale (foudre), Nyx Seraph (vide) ou Elias Quill (temps), une difficulté et un mode. Le journal contient le tutoriel, le bestiaire, les réglages, la carrière et les sauvegardes.

| Action | Clavier / souris | Manette standard |
|---|---|---|
| Bouger | ZQSD / WASD / flèches | Stick gauche |
| Viser / tirer | Souris / clic gauche maintenu | Stick droit / RT |
| Arcane secondaire, 30 mana | Clic droit / 2 | LT |
| Canaliser dans le cercle | E maintenu | RB maintenu |
| Égide, 20 mana | F | LB |
| Esquive | Espace | A |
| Ultime, charge complète | R | Y |
| Pause | P / Échap | Start |
| Amélioration 1 / 2 / 3 | Clic ou Tab / Entrée | A / X / B |

Menu manette : gauche/droite choisit le personnage, haut/bas le mode, X la difficulté, Y le journal. Dans le journal : haut/bas déplace le focus, gauche/droite règle listes et curseurs, A active, B ferme. Au camp : A continue, B extrait. Au bilan : B revient au menu.

Sur écran tactile : stick, visée assistée, tir à maintenir, boutons de sorts et canalisation. Contraste, réduction des mouvements, qualité, volume et aides sont réglables. Une manette doit utiliser le mapping standard du navigateur.

## Progression durable

- Expédition : cinq failles, Tyran, résultat final.
- Endurance : nouveaux cycles après chaque Tyran, difficulté plafonnée, extraction volontaire au camp. Un camp enregistré peut être repris après fermeture ; une fermeture en combat revient au dernier camp, pas au dernier instant.
- XP : choix aux niveaux et après les failles. Une fois tous les rangs acquis, les récompenses deviennent soin, mana et score.
- Carrière : records, poussière, trois affinités déblocables, succès et vingt derniers résultats.
- Sauvegarde locale : migration v1/v2, export/import avec validation et copie de secours avant import, avertissement si stockage bloqué ou autre onglet devenu propriétaire du profil. Les profils des domaines différents restent distincts : utilisez l’export/import pour les transférer.

Attendre « Hors ligne prêt » une première fois avec du réseau. La version complète, moteur 3D inclus, est alors disponible hors ligne. Une nouvelle version se recharge volontairement au menu ou au bilan. Le fichier `RIFTCASTERS_3D_PLAY.html` de la distribution s’ouvre aussi directement depuis le disque, sans installation ni accès réseau. La persistance des fichiers locaux dépend du navigateur : exportez votre profil.

## Développer et vérifier

Node 22.13+ : `npm ci`, puis `npm run dev`.

Validation : `npm run qa`, `npx playwright install chromium`, `npm run test:e2e`, `npm audit --omit=dev --audit-level=high`.

`npm run build` génère le site dans `dist/client`, ainsi que le HTML autonome, les documents et notices dans `dist/release`. `npm run package:release` régénère seulement cette distribution à partir du même code. La CI publie un artefact téléchargeable après réussite des contrôles.

`/?qa=1` fournit les commandes de test accélérées documentées dans [QA](docs/QA.md). Il n’écrit jamais les records, profils ni checkpoints. Ces scénarios vérifient les transitions et les mécaniques, pas l’équilibrage humain.

Voir [conception](docs/GAME-DESIGN.md), [architecture](docs/ARCHITECTURE.md), [support](docs/SUPPORT.md) et [instructions de reprise](CODEX_MASTER_PROMPT.md). React, Three.js et les autres bibliothèques distribuées conservent leurs notices dans `THIRD_PARTY_NOTICES.txt`. Aucun fichier original de modèle 3D, texture, musique ou police externe n’est chargé au runtime : géométries, effets et audio sont procéduraux.
