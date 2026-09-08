# Exploitation, support et droits

## Joueur

La progression est enregistrée sur cet appareil et cette origine, sans compte joueur ni synchronisation serveur. Exporter régulièrement via le journal, notamment avant de changer d’adresse ou de navigateur. Le jeu ne transmet pas les sauvegardes ; les hébergeurs peuvent néanmoins produire leurs journaux de requêtes habituels.

Si un autre onglet a changé le profil, le jeu bloque les écritures de l’onglet périmé : exporter si nécessaire, fermer celui-ci puis recharger le profil récent. Un stockage indisponible n’empêche pas de jouer mais ne garantit pas la conservation. En Endurance, seule la dernière halte est un point de reprise. Le résultat d’une transmission en cours n’est pas sauvegardé à chaque seconde.

En cas d’écran 3D perdu, exporter ce qui peut l’être puis recharger ; réduire la qualité si nécessaire. Le fichier autonome reste indépendant du réseau, mais la sauvegarde `file://` dépend des politiques du navigateur. Le format web HTTPS est recommandé pour la PWA.

## Mainteneur

Avant chaque livraison : inspecter les modifications, valider QA/CI, exporter un profil de référence et publier les mêmes sources. Après livraison : vérifier page, moteur, téléchargements et service worker. Si régression bloquante, restaurer une version d’hébergement connue sans supprimer les profils ; garder les migrations compatibles avec les données récentes.

À chaque évolution de dépendance ou de contenu : relancer audit, tests et recettes concernées. Les fréquences de maintenance, durée de support, appareils officiellement soutenus, prix et canaux de vente doivent être décidés par le propriétaire ; ce dépôt n’instaure ni abonnement, ni surveillance automatique, ni engagement de maintenance illimitée.

## Provenance et autorisations

Personnages, textes et géométries/audio procéduraux appartiennent au contenu original du projet tel qu’implémenté ici. Aucun asset officiel d’une franchise tierce n’a été importé. Les polices utilisent des familles système ; les icônes d’interface et bibliothèques gardent leurs licences tierces. Le build rassemble les textes de licence et un inventaire versionné dans la distribution.

Cet inventaire technique n’est pas une vérification juridique de la disponibilité du nom RIFTCASTERS, des marques, ni du choix d’une licence pour le code original. Ces décisions, les mentions de distribution et les éventuelles conditions de vente nécessitent le propriétaire et, si nécessaire, une revue compétente. Aucune licence open source sur le jeu original ou autorisation commerciale supplémentaire n’est inventée par cette livraison.
