# Installation iPhone

Cette version est une PWA : une web app installee depuis Safari sur l'ecran d'accueil.

## Pourquoi ce choix

Pour une premiere version personnelle, c'est plus simple qu'une app native : pas de compte developpeur Apple, pas d'App Store, pas de TestFlight, pas de validation Apple. Donc forcement moins de ceremonie absurde pour cocher trois series de squats.

## Etapes

1. Publier le dossier `sport-coach-app` sur une URL HTTPS.
2. Ouvrir l'URL dans Safari sur l'iPhone.
3. Toucher Partager.
4. Toucher "Sur l'ecran d'accueil".
5. Activer "Ouvrir comme app web" si disponible.
6. Toucher "Ajouter".

## A verifier apres installation

- L'app s'ouvre depuis l'icone d'accueil.
- L'interface n'affiche pas la barre d'adresse Safari.
- Une seance peut etre lancee.
- Les videos s'affichent.
- L'historique reste present apres fermeture/reouverture.
- L'app fonctionne encore apres passage en mode avion, une fois chargee au moins une fois.

## Limites V1

- Les donnees restent locales au navigateur/iPhone.
- Si les donnees Safari sont effacees, l'historique peut disparaitre.
- L'export JSON doit etre utilise regulierement.
- Pas de notifications dans cette V1.
- Pas de publication App Store pour l'instant.
