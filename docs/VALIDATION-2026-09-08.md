# Validation du 8 septembre 2026

Candidate `1.0.0-rc.1`, Windows / Chromium automatisé. Cette fiche rapporte les contrôles effectivement terminés avant publication, pas une certification commerciale.

| Contrôle | Résultat |
|---|---|
| Lint et TypeScript | Réussis |
| Vitest : combat, progression, carrière, checkpoint | 26 tests réussis |
| Playwright : normal, accéléré, stockage, tactile, manette, hors ligne, fichier autonome, mise à jour, nettoyage graphique | 17 scénarios réussis, aucun ignoré |
| Build du site et HTML autonome | Réussis, même code source |
| Audit des dépendances de production | 0 vulnérabilité signalée |
| Inspection visuelle | Menu bureau, choix de résonance et combat tactile inspectés ; superpositions mobiles corrigées |
| Distribution | HTML autonome, somme SHA-256, documentation, inventaire des bibliothèques distribuées et notices présentes |

Régressions corrigées pendant cette passe : séparation niveaux/failles, pool de build épuisé, phases irréversibles du Tyran, effets de stase et brûlure, reprise/extraction Endurance, conflits d’onglets, stockage bloqué, réglages de manette, pause hors focus, cache hors ligne avec Vary: Origin, accès au bouton de mise à jour et chevauchements tactiles.

Le contrôle de géométries porte sur quatre campagnes accélérées consécutives, pas sur une mesure VRAM de plusieurs heures. Les tests de manette utilisent un mapping simulé. Le test de mise à jour utilise deux révisions de service worker dans un serveur isolé. Les tests accélérés n’écrivent aucune progression.

Restent à obtenir : sessions humaines longues et équilibrage comparatif, appareils et manettes physiques ciblés, validation de la direction artistique/ergonomie par les joueurs, choix de distribution/prix/support et revue des droits nécessaires. Voir RELEASE-GATES.md et QA.md. Ne pas annoncer le jeu commercialement terminé sur la seule base de cette fiche.

La CI attachée au commit publié est l’autorité pour sa validation Linux et ses artefacts ; les états des hébergements sont vérifiés séparément après publication.
