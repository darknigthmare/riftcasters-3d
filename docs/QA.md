# Vérification reproductible

## Porte technique

1. `npm ci` avec Node 22.13 ou plus.
2. `npm run qa` : lint, types, règles/sauvegardes, site et fichier autonome.
3. `npx playwright install chromium`, puis `npm run test:e2e`.
4. `npm audit --omit=dev --audit-level=high`.
5. Vérifier la CI du commit publié, le chargement public et les fichiers du même build. Conserver les résultats réels et ne pas transformer un test ignoré en réussite.

Les tests démarrent leur propre serveur strict sur 5187. `RIFT_TEST_URL` cible une version déjà déployée ; le scénario fichier local est alors explicitement ignoré. Chromium utilise le rendu logiciel pour la compatibilité des machines CI : cela ne mesure pas les performances d’un téléphone ou d’un GPU physique.

## Parcours automatisés

Profil normal : choix, préférences, journal, démarrage, mana, pause, abandon, sauvegarde et rechargement. Checkpoint Endurance déjà enregistré, reprise et extraction sans double attribution. Conflit de deux onglets. Stockage bloqué. Manette standard simulée. Menu et commandes tactiles à 390 × 844, avec détection des chevauchements. Site téléchargé puis rechargé sans réseau. Fichier HTML ouvert via `file://` sans requête HTTP.

Parcours structurels accélérés : quatre personnages, XP sans saut de vague, cinq failles, trois phases irréversibles du Tyran, victoire ; Endurance au-delà du premier cycle et pool totalement maîtrisé. Régressions des brûlures, stase, chaînes et marques du vide. Quatre campagnes consécutives contrôlent la libération des géométries transitoires. Une fixture de serveur de mise à jour vérifie l’attente pendant le combat, l’activation au bilan, la conservation du profil et le retour hors ligne. Un bouton de manette maintenu ne doit pas annuler une pause après perte de focus.

`/?qa=1` expose `window.__riftTest` : `state()` et `command(action, value)`. Actions : `step` (frames, maximum 3 000), `rift`, `xp`, `damage`, `boss-health` (ratio), `kill-boss`, `ultimate`, `max-build` (épuise le catalogue pour vérifier la récompense de substitution), `effect-fixture` (deux cibles résistantes isolées), `elemental-impact`. Cette API n’existe pas dans une partie normale. Aucune écriture de progression en mode QA.

Ne pas utiliser ces raccourcis comme preuve que le jeu est équilibré, agréable sur plusieurs heures ou compatible avec toutes les manettes. Les captures et traces d’échec sont dans `outputs/`, ignoré par Git.

## Recette humaine encore obligatoire pour une sortie commerciale

| Surface | Manipulation attendue | Preuve à conserver |
|---|---|---|
| Équilibrage | Campagnes sans QA, quatre personnages, trois difficultés | Durée, victoire/défaite, build, cause, commentaires |
| Endurance | Au moins une session longue, plusieurs reprises de camp | Cycles, temps, fluidité, absence de blocage |
| Appareils | GPU intégré, Android et iOS physiques ciblés | Modèle, OS, navigateur, qualité, FPS et autonomie |
| Contrôles | AZERTY/QWERTY, manettes physiques, multitouch et rotation | Mapping, ergonomie, interruptions |
| Accessibilité | Contraste, mouvements réduits, zoom/journal, clavier seul | Lecture réelle, focus, fatigue visuelle |
| Sauvegarde | Import valide/invalide, stockage plein, suppression cache, autre origine | Export récupérable, messages honnêtes |
| Cycle de version | Ancien client ouvert, nouvelle publication, activation au menu, retour hors ligne | Pas de perte de profil ni mélange de fichiers |
| Récupération | Perte WebGL, onglet masqué, navigateur arrêté en combat/camp | Reprise au point documenté, aucune récompense doublée |

Les contrôles non effectués restent « à valider ». Pour une régression, joindre version/URL, navigateur, mode, personnage, étapes, attendu, obtenu et export de profil si utile. Ne pas joindre de données privées étrangères au jeu.
