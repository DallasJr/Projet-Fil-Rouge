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
npm run dev
```

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