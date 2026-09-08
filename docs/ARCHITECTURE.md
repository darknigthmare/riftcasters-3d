# Architecture et invariants

## Responsabilités

- `RiftEngine.ts` possède la simulation, les entités Three.js, les commandes et la machine d’états. React reçoit des instantanés HUD ; il ne pilote pas une boucle concurrente.
- `RiftcastersExperience.tsx` possède chargement, présentation, interactions et surfaces de diagnostic. `CommandCenter.tsx` présente configuration, guide, paramètres et carrière.
- `content.ts` définit personnages, chapitres et contenu. `rules.ts` expose les règles testables sans WebGL.
- `progression.ts`, `career.ts` et `checkpoint.ts` valident les données entrantes. Ne jamais sérialiser la scène Three.js ni accepter des rangs non bornés.
- `RiftAudio.ts` synthétise les effets avec Web Audio, après interaction utilisateur, avec volume et mode muet.

## Machine d’états

Menu → combat → choix de niveau (même vague) ou choix de faille (vague suivante). La sixième vague fait apparaître le Tyran. Une victoire d’Expédition mène au bilan ; une victoire d’Endurance mène au camp, puis au cycle suivant ou à l’extraction. Pause, perte de visibilité, défaite et abandon disposent de chemins explicites.

Le bilan est enregistré une seule fois par instance. L’extraction consomme le checkpoint dans la même écriture que les récompenses. Reprise et continuation du camp utilisent les mêmes ressources normalisées. Un conflit d’onglet empêche les écritures du profil périmé ; ce garde-fou local ne remplace pas une base transactionnelle multijoueur.

## Durabilité

La clé `riftcasters-save-v2` conserve sa compatibilité ; les ajouts possèdent des valeurs par défaut. Garder des fixtures des anciennes versions. Exporter avant import ; refuser les checkpoints explicitement invalides. Ne pas effacer une sauvegarde parce qu’une écriture échoue. Ne pas promettre de cloud : localStorage peut être purgé et chaque origine a son profil.

Les entités sont retirées et leurs géométries/matériaux libérés au nettoyage. Ennemis, projectiles, particules et pickups ont des budgets. La menace Endurance est bornée. Les nouvelles familles doivent respecter les mêmes plafonds, télégraphes et nettoyage.

## Livraison unique

Vite produit un site à moteur différé. Le paquet autonome compile exactement les mêmes sources sans découpage puis intègre JS/CSS dans un HTML. Le service worker précharge uniquement le site public, moteur compris, et attend une activation volontaire pour une mise à jour. Les caches précédents sont conservés pendant la coexistence de plusieurs fenêtres.

La distribution inclut les notices des dépendances présentes dans les chunks (et Tailwind pour le CSS). Les secrets de publication ne doivent jamais entrer dans Git, le client, un bundle ou une archive. Aucun backend de joueur n’existe actuellement.
