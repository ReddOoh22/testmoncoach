# Coach Sportif - Version iPhone PWA

Prototype personnel en HTML, CSS et JavaScript, prepare pour fonctionner comme une app installable sur iPhone via Safari.

## Ce qui a ete ajoute pour iPhone

- `manifest.webmanifest` pour declarer le nom, l'icone et le mode app.
- `service-worker.js` pour le cache hors ligne apres premier chargement.
- Icônes iPhone et PWA dans `icons/`.
- Meta-tags Apple dans `index.html`.
- Carte d'aide "Installer sur l'ecran d'accueil" dans l'app.
- Gestion des zones de securite iPhone avec `safe-area-inset`.

## Lancer en local sur ordinateur

1. Dezipper le dossier.
2. Ouvrir `index.html` dans un navigateur pour un test rapide.

Note : le mode PWA complet et le service worker ne fonctionnent pas correctement en `file://`. Pour tester comme une vraie app, il faut heberger le dossier en HTTPS ou utiliser un serveur local.

## Installer sur iPhone

1. Heberger le dossier sur une URL HTTPS.
2. Ouvrir cette URL dans Safari sur l'iPhone.
3. Toucher le bouton Partager.
4. Choisir "Sur l'ecran d'accueil".
5. Activer "Ouvrir comme app web" si l'option apparait.
6. Toucher "Ajouter".
7. Lancer l'app depuis l'icone creee.

## Hebergement simple recommande

Pour une V1 personnelle, le plus simple est GitHub Pages, Netlify ou Vercel. Le dossier est statique, donc aucun serveur applicatif n'est necessaire.

## Donnees

Les donnees d'historique sont stockees dans le navigateur via `localStorage`. Elles restent sur l'appareil. Utilise l'export JSON dans les reglages pour sauvegarder l'historique.

## Fonctionnalites V1

- Accueil avec prochaine seance recommandee.
- Planning hebdomadaire souple.
- Programme avec detail des seances.
- Suivi serie par serie en fait / pas fait.
- Timer de repos automatique.
- Bouton douleur / gene pendant la seance.
- Resume de fin de seance.
- Historique local.
- Export JSON de l'historique.
- Installation sur l'ecran d'accueil iPhone.
- Cache hors ligne apres premier chargement.
