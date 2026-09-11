# Salmon of Doubt Demo Template

Canonical production scaffold for future `/demos/` projects.

Use this template before inventing a new demo structure.

## Required pattern

- Keep the Install button in static `index.html` so it is present from first paint.
- Keep the Zenodo/DOI element in static `index.html`.
- Use placeholder DOI `10.5281/zenodo.0000000` until a real Zenodo record exists.
- Keep the DOI `position: fixed` at bottom-right on desktop **and mobile**.
- Account for `env(safe-area-inset-bottom)` on mobile.
- Keep DOI below the shared Support control and away from the shared Demos control.
- Load local CSS directly in `<head>`.
- Use a manifest with `scope: "./"` and a service worker registered with `scope: "./"`.
- Cache only this demo's shell in the service worker.
- When CSS/JS changes, bump the query-string asset version in `index.html`.
- When cached shell behaviour changes, bump `CACHE_NAME` in `service-worker.js`.
- Verify actual DOM class, CSS selector, loaded asset version, and mobile breakpoint before declaring a fix complete.

## Files

- `index.html` — static production shell, install control, install dialog, DOI element.
- `styles.css` — responsive base layout plus fixed DOI behaviour.
- `app.js` — install prompt/fallback, DOI config, service-worker registration.
- `site-config.js` — DOI configuration.
- `manifest.webmanifest` — install metadata and scope.
- `service-worker.js` — scoped offline shell.
- `icon.svg` — placeholder icon; replace for each real demo.

## Starting a new demo

Copy this directory, rename the app metadata/title/icon, add the actual content inside `.demo-stage`, update `site-config.js`, change the cache name, then add the new path to `../catalog.js`.
