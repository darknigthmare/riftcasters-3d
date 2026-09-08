# Reprendre RIFTCASTERS sans perdre le contrat

Tu maintiens RIFTCASTERS 3D — Convergence, jeu web solo React/TypeScript/Three.js, et non le projet Unreal/Stargate du propriétaire. Commence par README, docs/RELEASE-GATES.md et git status. Préserve les modifications existantes, sauvegardes et secrets. Travaille dans ce dépôt uniquement.

Le socle fonctionnel est : Kaela/feu, Orin/foudre, Nyx/vide, Elias/temps ; cinq failles dans une arène ; six familles ordinaires, élites et Tyran à trois phases ; combat primaire/secondaire/égide/esquive/ultime ; mana, XP, quinze améliorations à trois rangs, pickups, combo ; douze succès, progression locale migrée, export/import ; Expédition finie et Endurance avec camp/reprise/extraction ; clavier, manette standard, tactile, accessibilité ; web hors ligne et fichier HTML autonome produits depuis le même code.

Ne jamais annoncer une fonction sur la seule base de son nom ou d’un texte. Vérifie son effet dans RiftEngine et son chemin utilisateur. Un niveau ne doit pas avancer la vague, un Tyran soigné ne doit pas revenir à une phase antérieure, l’épuisement du catalogue ne doit pas bloquer une campagne, l’extraction ne doit pas dupliquer les récompenses. Une sauvegarde explicitement invalide doit être refusée sans détruire la précédente.

Pour une correction : reproduis, écris une régression pertinente, implémente, relance npm run qa puis npm run test:e2e et l’audit de production. Les tests QA accélérés sont isolés de la progression ; utilise aussi les parcours normaux. Regarde les captures pour juger lisibilité, chevauchements, tactile et télégraphes. Les tests logiciel/CI ne certifient ni équilibrage humain ni matériel physique.

Si publication demandée : vérifie les cibles GitHub, Vercel et le site déclaré dans .openai/hosting.json ; utilise leurs procédures autorisées, préserve l’accès du site, et ne publie que les sources réellement validées. Aucun secret dans Git ou les archives. Confirme CI, état final et chargement réel. Pas de vente, dépense, inscription de marque ou promesse de support sans décision explicite du propriétaire.

Le mot « terminé » signifie que les critères nécessaires sont réellement satisfaits. Signale précisément les validations manquantes et les décisions externes ; ne remplace pas un blocage réel par un pourcentage inventé, une promesse de tâche en arrière-plan ou une certification commerciale sans preuve.
