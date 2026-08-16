# Kolik hodin? (How Many Hours?)

A Czech-first PWA that converts a price into hours of work, to make impulse
purchases feel real before you buy. Type a price, see how many hours of your
life it costs, decide.

## Project structure

```
index.html      -- HTML shell: fonts, PWA meta tags, storage shim, loads app.jsx
app.jsx         -- the entire app (single React component tree, no build step)
manifest.json   -- PWA manifest (name, icons, colors)
sw.js           -- service worker (network-first caching, offline fallback)
icons/          -- app icons (192, 512, maskable 512)
```

## Why no build step?

This project is deliberately a single `app.jsx` file loaded via in-browser
Babel (see the `<script>` tags in `index.html`), rather than a Vite/webpack
setup. That was a conscious choice early on: no `npm install`, no build
pipeline, just open `index.html` and it runs. React, ReactDOM, and Babel load
from cdnjs at runtime.

Trade-off: editing is just "open app.jsx, edit, save" -- no hot reload, no
bundling, no TypeScript. If you outgrow that (want real modules, tree-shaking,
a component per file, etc.), migrating to Vite is a reasonable next step --
just ask Claude Code to scaffold it. This README describes the current
no-build-step setup.

## Running it locally

Any static file server works, since it's plain HTML/JS:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open the printed localhost URL. Opening `index.html` directly via
`file://` mostly works too, but a local server is more reliable (service
worker registration and some fetches behave better over http/https).

## Deploying

This is built for GitHub Pages:

1. Push this repo to GitHub
2. Repo Settings -> Pages -> Deploy from branch -> `main` / root
3. Your app is live at `https://<username>.github.io/<repo>/`

To get an installable Android APK, paste that URL into
[PWABuilder.com](https://www.pwabuilder.com) and generate an Android package.

**After any change**, redeploy by pushing to GitHub -- Pages picks it up
automatically. If a change doesn't seem to show up on your phone, the service
worker may be serving a cached copy; it's already configured network-first,
but if you ever need to force a full refresh, bump the `CACHE` version string
at the top of `sw.js`.

## Optional: account & cloud sync

The app works fully offline on-device with zero setup. If you want to sync
data between devices, wire up a free Firebase project:

1. Go to [console.firebase.google.com](https://console.firebase.google.com) ->
   create a project (Analytics not needed)
2. **Build -> Authentication** -> enable **Email/Password**
3. **Build -> Firestore Database** -> create database -> production mode
4. In Firestore's **Rules** tab, paste:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```
   This ensures each account can only ever read/write its own data. Click
   **Publish**.
5. **Project settings** (gear icon) -> scroll to "Your apps" -> click the
   `</>` web icon -> register the app -> copy the `firebaseConfig` object
6. In `index.html`, find `window.FIREBASE_CONFIG = {...}` and replace every
   `"YOUR_..."` placeholder with your real values
7. Redeploy

Without this, the "Account & sync" section in Settings just says sync isn't
configured -- everything else works normally.

## Security notes

- No secrets are embedded in the client that need protecting -- the Firebase
  config is meant to be public; access control lives in the Firestore rules
  above, not in hiding the config.
- The app supports an optional PIN lock (Settings -> App lock) that encrypts
  local data with AES-GCM (via the browser's Web Crypto API), key derived
  from the PIN via PBKDF2. **There is no PIN recovery** -- that's what makes
  it real encryption. This currently only protects local storage; if cloud
  sync is also enabled, Firestore still holds an unencrypted copy (a known,
  documented gap -- see conversation history / CHANGELOG if you add one).
- A Content-Security-Policy meta tag sets `object-src 'none'` and
  `base-uri 'self'`. It deliberately does *not* restrict `script-src` --
  Tesseract.js (used for the camera price-scan feature) loads additional
  resources internally whose exact origins aren't pinned down; locking that
  directive down without verifying against Tesseract's real behavior risks
  silently breaking the camera scanner.
- `frame-ancestors` (clickjacking protection) can't be set via a `<meta>` tag
  -- it only works as a real HTTP header, which GitHub Pages doesn't let you
  configure. Moving to Netlify/Cloudflare Pages would close that gap if it
  matters to you.

## Known limitations worth knowing about

- Camera price-scanning (OCR via Tesseract.js) only works on the deployed
  site over HTTPS -- it needs real camera permissions, so it won't work in a
  sandboxed preview.
- Currency conversion (frankfurter.app) and account/sync (Firebase) both need
  real network access -- same deal, deployed-site-only.
- Backup export (JSON) and CSV export are both unencrypted by design, even if
  PIN lock is enabled -- that's what makes them portable/readable. Be
  deliberate about where exported files end up.
