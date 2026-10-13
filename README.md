# site_travaux – Validation des présences (App Node.js)

Application Express autonome permettant aux **référents travaux** de valider les présences de leurs sessions, directement depuis leur navigateur — avec ou sans connexion (accès par lien email tokenisé).

---

## Fonctionnalités

| Feature | Description |
|---|---|
| **Connexion famille** | Login / mot de passe (compatible bcrypt, MD5 legacy, crypt legacy) |
| **Liste "Mes sessions"** | Toutes les sessions où la famille connectée est référente, triées par date |
| **Aperçu / gestion** | Avant le jour J : liste des inscrits, retrait possible |
| **Validation jour J** | Cocher présents, ajuster unités, commentaires individuels + global, marquer no-show |
| **Accès par token email** | Lien `/token/<token>` sans login (compatible avec les tokens générés par le cron PHP) |
| **Responsive** | Utilisable sur mobile |

---

## Prérequis

- Node.js ≥ 18
- Accès à la base MySQL de `site_travaux`
- Les tables `travaux`, `infos`, `famille`, `trombi`, `groupes_member`, `validation_tokens` existantes

---

## Installation

```bash
cd ref-validation
npm install

# Copier et adapter la configuration
cp .env.example .env
# → éditer .env avec les infos de connexion BDD
```

## Migration BDD (une seule fois)

```sql
-- Exécuter sur la base de production :
SOURCE migration_node_app.sql;
```

Ajoute les colonnes `commentaire_ref` (travaux), `validated_by_ref`, `validated_by_ref_at`, `commentaire_ref` (infos) et crée la table `validation_tokens` si elle n'existe pas.

---

## Démarrage

```bash
# Production
npm start

# Développement (rechargement automatique, Node 18+)
npm run dev
```

L'application écoute sur `http://localhost:3000` (configurable via `PORT`).

---

## Structure

```
ref-validation/
├── src/
│   ├── server.js      # Express – routes, guards, logique métier
│   ├── models.js      # Toutes les requêtes SQL (miroir des modèles CI)
│   ├── helpers.js     # Utilitaires : formatage, validation
│   └── templates.js   # Génération HTML côté serveur (sans moteur externe)
├── public/
│   ├── style.css      # CSS complet de l'application
│   └── app.js         # Interactions JS client
├── migration_node_app.sql
├── .env.example
└── package.json
```

---

## Routes

| Méthode | URL | Description |
|---|---|---|
| GET | `/` | Redirect selon connexion |
| GET/POST | `/login` | Connexion famille |
| GET | `/logout` | Déconnexion |
| GET | `/sessions` | Liste "Mes sessions" (auth requise) |
| GET | `/session/:id` | Détail session (auth + vérification référent) |
| POST | `/session/:id` | Valider présences / retirer un inscrit |
| GET | `/token/:token` | Accès par lien email (sans login) |
| POST | `/token/:token` | Valider par token |

---

## Compatibilité avec le site_travaux PHP

- **Lecture seule** du schéma existant : aucune modification des tables `travaux`, `infos`, `famille`, `trombi`, `groupes_member`
- Les colonnes ajoutées (`commentaire_ref`, `validated_by_ref`, `validated_by_ref_at`) sont optionnelles en PHP et ignorées silencieusement
- Les tokens `validation_tokens` sont lisibles/écrits par les deux applications
- Le champ `nb_unites_valides` est mis à jour de la même façon que `_ProcessRefValidation()` dans le contrôleur CI
- L'application ne gère pas la génération de tokens ni l'envoi d'emails — ceux-ci restent sous la responsabilité du cron PHP (`send_ref_validation_mails`)

---

## Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `DB_HOST` | `localhost` | Hôte MySQL |
| `DB_PORT` | `3306` | Port MySQL |
| `DB_USER` | `root` | Utilisateur BDD |
| `DB_PASS` | *(vide)* | Mot de passe BDD |
| `DB_NAME` | `site_travaux` | Nom de la base |
| `PORT` | `3000` | Port d'écoute HTTP |
| `SESSION_SECRET` | *(dev)* | Secret sessions Express |
| `APP_BASE_URL` | `http://localhost:3000` | URL publique (pour les liens) |
