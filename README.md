# RIFTCASTERS

Arena-survivor 3D jouable directement dans le navigateur. Incarnez un
Riftcaster, stabilisez trois failles sous la pression des anomalies, façonnez
votre build entre les vagues et affrontez le Titan de la Faille.

## Jouer

- ZQSD / WASD / flèches : déplacement
- Souris : viser
- Clic gauche maintenu : traits arcaniques
- Clic droit : puits gravitationnel
- E : égide prismatique
- Espace : esquive (deux charges)
- R : brisure dimensionnelle
- P / Échap : pause

Le jeu prend aussi en charge la manette et propose des commandes tactiles
adaptées aux appareils mobiles.

## Boucle de jeu

Chaque faille doit être canalisée depuis sa zone. Les ennemis proches ralentissent
la stabilisation : il faut donc alterner placement, contrôle de foule et burst.
Une résonance parmi trois est choisie après chaque faille. La quatrième vague
oppose le joueur au Titan, avec projectiles radiaux et zones télégraphiées.

La progression locale conserve le meilleur score et la poussière d’éther gagnée
entre les transmissions.

## Développement

Installer puis lancer :

    npm install
    npm run dev

Validation complète :

    npm run qa

Un mode de QA accéléré est disponible avec /?qa=1.

## Stack

React 19, TypeScript, Three.js, Vite, Tailwind CSS et Vitest.
