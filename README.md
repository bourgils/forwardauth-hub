# forwardauth-hub

Serveur d’authentification centralisé pour les applications placées derrière le middleware ForwardAuth de Traefik/Coolify. Il fournit les utilisateurs locaux, les sessions SSO cross-domain, les applications, les permissions, le login et l’administration dans une seule image.

L’interface est une SPA React/TypeScript construite avec Vite et Material UI. Express sert son build statique et conserve la responsabilité exclusive de l’authentification, des sessions, du CSRF et des autorisations.

## Déploiement Coolify

### 1. Publier l’image

Pousser ce dépôt sur GitHub. Le workflow `.github/workflows/docker.yml` teste puis publie automatiquement `ghcr.io/bourgils/forwardauth-hub` pour `linux/amd64` et `linux/arm64` sur `main` et sur les tags `v*`.

Dans GitHub, ouvrir **Packages → forwardauth-hub → Package settings** et rendre le package public. S’il reste privé, configurer les identifiants GHCR dans Coolify.

### 2. Créer le service

Dans Coolify :

1. **New Resource → Docker Compose** depuis le dépôt Git.
2. Utiliser `compose.yaml`.
3. Renseigner les variables détectées par Coolify.
4. Affecter au service `auth-server` le domaine `https://auth.example.com:3000`.
5. Déployer puis vérifier `https://auth.example.com/ready`.

Valeurs indispensables :

```env
SESSION_SECRET=<sortie de openssl rand -hex 32>
SSO_MODE=cross-domain
PUBLIC_URL=https://auth.example.com
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_PASSWORD=<mot de passe aléatoire d’au moins 12 caractères>
```

Le volume nommé `auth-data` conserve `/data/auth.db`. Ne pas ajouter de mapping `ports:` : le conteneur doit rester accessible uniquement via Traefik.

Après la première connexion, retirer `BOOTSTRAP_ADMIN_USERNAME` et `BOOTSTRAP_ADMIN_PASSWORD` de la configuration puis redéployer. Ils sont ignorés dès qu’un utilisateur existe, mais il est inutile de conserver le secret initial dans l’environnement.

### 3. Configurer les applications

Ouvrir `https://auth.example.com/admin`, puis :

1. créer les utilisateurs ;
2. ajouter chaque hostname sans protocole ni chemin ;
3. ouvrir **Permissions** pour autoriser explicitement les utilisateurs.

L’absence de règle refuse l’accès, y compris pour un administrateur.

### 4. Créer le middleware Traefik

Dans **Server → Proxy → Dynamic Configurations**, créer `coolify-auth.yml` à partir de `deploy/traefik-dynamic.yml` et remplacer `auth.example.com`.

Pour une application Docker Compose protégée :

```yaml
services:
  jellyfin:
    labels:
      - "coolify.traefik.middlewares=coolify-auth@file"
```

Pour une application Coolify standard, désactiver temporairement **Readonly labels**, puis ajouter `coolify-auth@file` à la liste `middlewares` du routeur HTTPS existant. Ne pas appliquer ce middleware au serveur d’authentification lui-même.

Traefik transmet les en-têtes `X-Forwarded-*` au serveur d’authentification et remplace les éventuels en-têtes `X-Auth-*` entrants avec la réponse d’autorisation. Les labels de `compose.yaml` ajoutent également un routeur HTTPS global et prioritaire pour `/_forwardauth/callback`. Ce chemin réservé est envoyé à AuthServer sans middleware ForwardAuth ; tous les autres chemins restent servis par l’application cible.

### 5. Fonctionnement cross-domain

Une connexion sur `PUBLIC_URL` crée une session SSO limitée au domaine d’authentification. Pour chaque application, AuthServer émet ensuite un code à usage unique et le navigateur visite `https://application.example/_forwardauth/callback`. Le callback crée une session limitée à ce hostname avant de revenir à l’URL initiale.

Le même AuthServer peut ainsi protéger `app.example.com` et `app.other-domain.fr` sans partager de cookie entre les domaines et sans modifier les applications. Le cookie applicatif est lié en base à l’application concernée ; il est refusé sur tout autre hostname.

### 6. Recette de production

```text
GET  https://auth.example.com/health             → 200 {"status":"ok"}
GET  https://auth.example.com/ready              → 200 {"status":"ok"}
HTML sans session vers une app protégée          → 302 /login, puis retour exact
HTML vers une app d’un autre domaine déjà en SSO → callback, sans nouvelle saisie du mot de passe
GET  https://app.example.com/_forwardauth/callback avec code invalide → erreur
API sans session                                 → 401
WebSocket sans session                           → 401
Utilisateur sans permission                      → 403
Utilisateur autorisé                             → 200 puis application cible
```

Vérifier également que les ports natifs des applications protégées ne sont pas publiés sur l’hôte.

## Développement local

```bash
cp .env.example .env
npm install
npm run dev
```

Dans un second terminal :

```bash
npm run dev:frontend
```

Ouvrir `http://localhost:5173`. Vite transmet `/api`, `/health` et `/ready` au backend sur le port `3000`.

Pour un test HTTP local, définir `COOKIE_SECURE=false` et `PUBLIC_URL=http://localhost:5173`.

Validation complète :

```bash
npm run typecheck
npm test
npm run build
```

## Configuration

| Variable | Défaut | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:/data/auth.db` | SQLite ou URL PostgreSQL |
| `SESSION_SECRET` | — | Secret obligatoire, 32 caractères minimum |
| `SESSION_TTL` | `30d` | Durée `ms`, `s`, `m`, `h` ou `d` |
| `SSO_MODE` | `single-domain` | `single-domain` ou `cross-domain` ; le Compose active `cross-domain` |
| `COOKIE_NAME` | `coolify_auth` | Cookie du mode historique `single-domain` |
| `SSO_COOKIE_NAME` | `forwardauth_sso` | Cookie central du mode cross-domain |
| `APPLICATION_COOKIE_NAME` | `forwardauth_app` | Cookie local lié à une application |
| `COOKIE_DOMAIN` | — | Domaine partagé, utilisé uniquement en mode `single-domain` |
| `COOKIE_SECURE` | `true` | Cookie HTTPS uniquement |
| `COOKIE_SAME_SITE` | `lax` | `lax`, `strict` ou `none` |
| `PUBLIC_URL` | auto | Origine canonique d’AuthServer, obligatoire en mode cross-domain |
| `AUTHORIZATION_CODE_TTL` | `60s` | Durée des codes à usage unique |
| `CALLBACK_PATH` | `/_forwardauth/callback` | Chemin global routé vers AuthServer |
| `SIGNUP_ENABLED` | `false` | Inscription publique |
| `ADMIN_UI_ENABLED` | `true` | Interface `/admin` |
| `ALLOWED_REDIRECTS` | — | Hostnames initialisés au démarrage |
| `TRUSTED_PROXIES` | réseaux privés | Plages autorisées à fournir `X-Forwarded-*` |
| `LOG_LEVEL` | `info` | Niveau des logs JSON stdout/stderr |

## Sauvegarde

SQLite suppose une seule instance du service. Sauvegarder régulièrement le volume `auth-data`; pour une copie cohérente, arrêter brièvement le service ou utiliser un outil de sauvegarde SQLite prenant en charge le mode WAL.

Documentation de référence : [Docker Compose dans Coolify](https://coolify.io/docs/knowledge-base/docker/compose), [middlewares personnalisés Coolify](https://coolify.io/docs/knowledge-base/proxy/traefik/custom-middlewares), [ForwardAuth Traefik](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/forwardauth/), [publication GHCR](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).
