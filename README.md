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
adaptées aux appareils mobiles. À la manette : stick gauche pour se déplacer,
stick droit pour viser, gâchette droite pour tirer, A pour esquiver, LB pour
l’égide, LT pour le puits, Y pour la brisure et Start pour la pause. A démarre
ou relance aussi une transmission ; aux choix de résonance, A/X/B sélectionnent
respectivement les cartes 1/2/3.

## Boucle de jeu

Chaque faille doit être canalisée depuis sa zone. Les ennemis proches ralentissent
la stabilisation et font monter la pression du Néant. Si elle atteint 100 %,
l’Arche cède : il faut donc alterner placement, contrôle de foule et burst.
Une résonance parmi trois est choisie après chaque faille. La quatrième vague
oppose le joueur au Titan, avec projectiles radiaux et zones télégraphiées.

La progression locale conserve le meilleur score, les victoires et la poussière
d’éther gagnée entre les transmissions. L’Archive de l’Arche permet de débloquer
une affinité Braise, Prisme ou Néant qui garantit une option de cette école à
chaque sélection. La poussière peut aussi recalibrer un tirage de résonances.
Les anciennes sauvegardes v1 sont migrées automatiquement.

## Développement

Installer puis lancer :

    npm install
    npm run dev

Validation complète :

    npm run qa

Un mode de QA accéléré est disponible avec /?qa=1. Il ne modifie jamais les
records, victoires, poussières ou affinités sauvegardés.

## Stack

React 19, TypeScript, Three.js, Vite, Tailwind CSS et Vitest.
