# app — connect GitHub, pick a repo

Minimal React frontend + a tiny OAuth backend. Blank page with one **Connect to
GitHub** button; after authorizing, a dropdown of the repositories you granted
access to.

## Why there's a backend
GitHub's OAuth token exchange needs the client *secret* and its token endpoint
has no CORS, so it cannot run in the browser. `server.js` is a ~120-line proxy:
it does the code→token exchange, keeps the token in an httpOnly cookie (never
exposed to JS), and serves `/api/me` and `/api/repos`. No database.

## Setup
1. Register an OAuth app at <https://github.com/settings/developers> → **New OAuth App**:
   - Homepage URL: `http://localhost:5173`
   - Authorization callback URL: `http://localhost:5173/api/auth/github/callback`
2. `cp .env.example .env` and paste in the Client ID + a generated Client Secret.
3. `npm install`
4. `npm run dev`  (starts the backend on :3001 and Vite on :5173)
5. Open <http://localhost:5173>, click **Connect to GitHub**, authorize, pick a repo.

## Flow
`Connect` → `/api/auth/github/login` → GitHub authorize → `/api/auth/github/callback`
(token saved in cookie) → back to the app → `/api/repos` fills the dropdown.
`Disconnect` clears the cookie.

## Note on per-repo selection
This uses an **OAuth App**: GitHub's authorize screen grants the chosen scope and
the dropdown lists every repo the token can see. If you want the user to tick
*specific* repositories on GitHub's own screen, that's the **GitHub App**
installation model — a drop-in upgrade to this same backend (swap the authorize
URL + token exchange, then read installation repos). Ask and I'll wire it.
