# Dublin Representative Finder, GitHub Pages build

This package is designed to **work as a static site on GitHub Pages**.

## What this version does

- runs with plain HTML, CSS, and JavaScript
- resolves Dublin political areas in the browser
- bundles representative contact data locally in `data/*.json`
- can refresh those bundled JSON files through GitHub Actions
- works best on GitHub Pages over HTTPS when the user clicks **Use my location**

## Files

- `index.html` — main page
- `styles.css` — styling
- `app.js` — client-side lookup logic
- `data/tds.json` — bundled Dublin TD contacts
- `data/councillors.json` — bundled Dublin councillor contacts
- `data/fallbacks.json` — council-directory fallbacks
- `scripts/update_data.py` — refresh script for GitHub Actions or local runs
- `.github/workflows/refresh-data.yml` — scheduled refresh workflow

## Deploy to GitHub Pages

1. Create a GitHub repository.
2. Upload the contents of this folder to the repository root.
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select your main branch and the **root** folder.
6. Save.

After GitHub Pages goes live, the site will be served over HTTPS.

## Refresh the local JSON data

### On GitHub

Open **Actions**, run **Refresh civic data**, and let it update the `data/*.json` files.

### Locally

```bash
python3 -m pip install requests beautifulsoup4
python3 scripts/update_data.py
```

## Important notes

- GitHub Pages will not run Python at request time. That is why this build is static-only.
- Browser geolocation is usually more reliable than free-text Eircode geocoding.
- South Dublin County Council currently has a bundled fallback contact in the initial package, but the refresh script is structured to populate richer data from official profile pages.
