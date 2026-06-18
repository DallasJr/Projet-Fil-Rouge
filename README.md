# Projet Fil Rouge

## Présentation

De nombreux clients hésitent à passer commande par téléphone, freinés par le stress ou l'appréhension que cela peut engendrer.

Notre solution élimine cet obstacle en proposant une expérience de commande entièrement en ligne, fluide et intuitive.

Grâce à notre plateforme, les clients accèdent au menu du restaurant et passent leur commande en toute simplicité, depuis un site web ou une application mobile. De leur côté, les employés bénéficient d'une gestion allégée des commandes, sans interruptions téléphoniques.

Le restaurant dispose également d'un panneau d'administration dédié, permettant de superviser et gérer l'ensemble des commandes en temps réel.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend Web | React |
| Backend | Node.js + Express + Prisma |
| Base de données | PostgreSQL |
| Mobile | React Native |

---

## Installation

### Prérequis

- Node.js
- npm
- Une base de données PostgreSQL accessible

### Backend

```bash
cd ./backend/
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Variables utiles pour l'upload d'images Cloudinary :

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_UPLOAD_PRESET=...
# ou, sans preset non signe :
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Les images sont envoyees au backend en `multipart/form-data` avec Multer, puis stockees sur Cloudinary.

### Frontend

```bash
cd ./frontend/
npm install
npm run dev
```

### Après un `git pull`

Si des nouvelles migrations sont disponibles, appliquez-les :

```bash
cd ./backend/
npx prisma migrate deploy
```

---

## Tests

### Backend (Tests d'intégration)

Les tests d'intégration du backend sont configurés avec **Vitest** et **Supertest** pour valider la restriction des routes d'administration aux rôles autorisés (ADMIN). Le client Prisma et les connexions PostgreSQL sont mockés afin que les tests s'exécutent de façon isolée et rapide (sans altérer la base de données).

Pour exécuter les tests d'intégration du backend :
```bash
cd ./backend/
npm run test
```

### Frontend (Tests E2E)

Les tests d'interface de bout en bout (E2E) sont configurés avec **Playwright**. Ils simulent le parcours utilisateur complet : Inscription d'un nouveau compte ➔ Déconnexion ➔ Connexion ➔ Ajout d'un plat au panier ➔ Validation de commande (paiement espèces) ➔ Connexion Administrateur ➔ Vérification de la présence de la commande sur le dashboard admin en temps réel.

Pour exécuter les tests E2E :
1. Lancez le serveur backend de développement :
   ```bash
   cd ./backend/
   npm run dev
   ```
2. Initialisez/vérifiez le compte administrateur E2E de test dans la base de données :
   ```bash
   cd ./backend/
   npx ts-node scripts/ensure-e2e-admin.ts
   ```
3. Exécutez Playwright (le serveur de développement frontend est démarré automatiquement par Playwright) :
   ```bash
   cd ./frontend/
   npm run test:e2e
   ```

