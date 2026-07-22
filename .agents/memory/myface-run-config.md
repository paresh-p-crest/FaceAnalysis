---
name: MyFace run config
description: Replit-specific quirks for running the MyFace artifact dev and prod workflows
---

## uvicorn PATH quirk
The Python Backend workflow must use `python -m uvicorn` (not bare `uvicorn`) because pip installs the binary to `.pythonlibs/bin/` which is not on the workflow PATH.

## Port conflict pattern
The `artifacts/myface: web` workflow (Next.js dev) crashes with `EADDRINUSE: address already in use 0.0.0.0:3000` every time it restarts because the previous Next.js process outlives the workflow SIGTERM. The permanent fix is a `predev` npm lifecycle hook in `artifacts/myface/package.json`:

```json
"predev": "node scripts/kill-port.mjs 3000",
```

pnpm/npm automatically runs `predev` before `dev`. Use the cross-platform helper `scripts/kill-port.mjs` (Windows: `netstat` + `taskkill`; Linux/Replit: `lsof` + `kill -9`). Always exits 0 if nothing is on the port.

**Do NOT** use `fuser -k 3000/tcp` — it kills PID 12 (`pid1`, Replit's proxy) which holds an ESTABLISHED connection to the port, not a LISTEN socket.

## ThemeProvider hydration mismatch
`utils/theme.jsx` originally used a `useState` lazy initializer that read `localStorage` via `typeof window !== 'undefined'`. This caused a server/client hydration mismatch (server renders `'light'`, client reads stored `'dark'`), which triggered React's "Invalid hook call" during hydration error recovery.

**Fix**: Always initialize `useState('light')` (same on server and client), then read localStorage in a `useEffect` after hydration:

```js
const [theme, setTheme] = useState('light')
useEffect(() => {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored && stored !== 'light') setTheme(stored)
}, [])
```

**Why:** React's hydration must produce identical HTML on server and client for the first render. The `useState` lazy initializer runs during render on both sides — accessing `localStorage` there violates this constraint. `useEffect` only runs client-side, after hydration completes.

## Middleware — JSON on `/` only for explicit Autoscale probes
Short-circuit `GET /` with `{"ok":true}` **only** for known probe UAs (`Go-http-client`, `kube-probe`, `curl`, `googlehc`, …) or `Accept: application/json`.

Never short-circuit for:
- Browser / Mozilla UAs
- `Replit/*` / `Replit-Agent/*` (Preview / Port Authority)
- `sec-fetch-dest: document|iframe`, `Accept: text/html`, RSC headers

Guessing from empty or `*/*` Accept alone false-matched Preview → `Invalid hook call` + hydration failure.

- Autoscale needs HTTP **200** on `/` within ~5s; probe JSON avoids next-intl/SSR delay/500 during cold start.
- Explicit JSON liveness also: `GET /healthz` → `{"ok":true}`.
- Smoke: `node scripts/test-middleware-probes.js`.

After changing middleware on Replit: restart the **artifacts/myface: web** workflow, then **Republish** (or hard-refresh Preview / Open dev URL) so the live preview is not on a stale process.

## Theme `<script>` / manual `<head>` — DO NOT restore
Never put in `app/[locale]/layout.jsx`:
- `localStorage` theme bootstrap `<script>`
- Google Fonts `<link>` tags (or any other manual `<head>` children)

**Proof from Next overlay (Agent Preview):**
```
+ <link href="fonts.googleapis.com/...Inter...">
- <script src="/__replco/static/devtools/injected.js">
```
Replit injects that script into `<head>`; React hydrates our font link against it → Recoverable Error.

Inter is loaded from `globals.css` (`@import`). Theme only via `ThemeProvider` after mount. Use Metadata API for title/icons only.

## Agent chat Preview vs Open URL
1. No manual `<head>` children (above).
2. `ClientAppShell` — static first paint, full app after mount.
3. `scripts/dev.mjs` + webpack strip React Refresh.

Restart **artifacts/myface: web** after sync. If Replit Agent restores font `<link>`s or the theme script, remove them again.
