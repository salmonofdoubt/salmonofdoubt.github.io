# Dublin Representative Finder

Dublin Representative Finder is a static GitHub Pages build that helps users identify the relevant Dublin constituency and local electoral area, then view the matching TD and councillor contacts.

## What this version does

- runs with plain HTML, CSS, and JavaScript
- resolves Dublin political areas in the browser
- bundles representative contact data locally in `data/*.json`
- can refresh those bundled JSON files through GitHub Actions
- works best on GitHub Pages over HTTPS when the user clicks **Use my location**
- now includes a support and crowdsourcing layer for funding, issue intake, and collaboration

## Live pages

- Demo: `https://salmonofdoubt.github.io/demos/td-lookup/`
- Support page: `https://salmonofdoubt.github.io/demos/td-lookup/support.html`

## Files

- `index.html` — main page
- `styles.css` — styling for the demo and support page
- `app.js` — client-side lookup logic
- `support.html` — funding, sponsorship, and crowdsourcing page
- `data/tds.json` — bundled Dublin TD contacts
- `data/councillors.json` — bundled Dublin councillor contacts
- `data/fallbacks.json` — council-directory fallbacks
- `scripts/update_data.py` — refresh script for GitHub Actions or local runs
- `.github/workflows/refresh-data.yml` — scheduled refresh workflow

## Support and crowdsourcing

This demonstrator is positioned as an **open civic utility** rather than a closed product.

Support is intended to fund:

- maintenance and bug fixing
- representative data refreshes
- accessibility and usability improvements
- documentation and provenance work
- future geographic expansion

Crowdsourcing is intended to cover:

- lookup or boundary bugs
- representative data corrections
- feature and coverage requests
- broader discussion through GitHub Discussions

## GitHub files added for this layer

At repository level:

- `.github/FUNDING.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/ISSUE_TEMPLATE/lookup-boundary-bug.yml`
- `.github/ISSUE_TEMPLATE/representative-data-correction.yml`
- `.github/ISSUE_TEMPLATE/feature-or-coverage-request.yml`

## Deploy to GitHub Pages

1. Commit the `demos/td-lookup` files into the Pages repo.
2. Commit the `.github` files at repository root.
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
- GitHub Discussions is a repository setting, so it still needs to be enabled manually in the repo settings if you want the discussion links to work.
