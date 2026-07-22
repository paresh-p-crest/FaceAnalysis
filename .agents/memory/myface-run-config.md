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

## Middleware `/` must not eat RSC / Preview
`middleware.js` short-circuits Autoscale health probes on `GET /` with `200 {"ok":true}`. That short-circuit must be **opt-in only**:

- Known probe UAs: `curl/`, `wget/`, `kube-probe`, `googlehc`, `Go-http-client`, healthcheck/uptime monitors
- Explicit `Accept: application/json` from a non-browser UA

**Never** short-circuit for:
- Next.js App Router flight (`RSC: 1`, `Accept: text/x-component`, `next-url`, …)
- Browser / WebView UAs (`Mozilla`, Chrome, Safari, …)
- Replit product UAs (`Replit/…`, `Replit-Agent/…`) unless they explicitly look like a healthcheck
- Empty or star-only Accept alone (this false-positive broke Agent Preview)

Those getting JSON instead of HTML/Flight produces `Invalid hook call` + hydration failure in Preview while a normal browser tab (sends `text/html`) still works.

**Block-comment trap:** never write the characters `*` followed immediately by `/` inside a `/* … */` comment in `middleware.js` (e.g. documenting Accept star-slash-star). It terminates the comment early → SyntaxError → 500s / Fast Refresh full reload → same Preview crash symptoms. Write “star Accept” in prose instead.

Regression smoke: `node scripts/test-middleware-probes.js` (against a running Next on :3000).

## allowedDevOrigins
`next.config.js` needs `'127.0.0.1'` in `allowedDevOrigins` to stop Replit's proxy from blocking `/_next/*` HMR requests:

```js
allowedDevOrigins: ['*.replit.dev', '*.pike.replit.dev', '*.repl.co', '127.0.0.1'],
```
