# EnvAI — visible template controls and a real navigation dropdown

This is a **local patch** for an already-installed EnvAI after the EnvAI semantic-guide patch. It does not change the tool catalogue, search ranking, network, colours, legend or discovery workflow.

## Improvements
- Removes the ambiguous three-dot / dash-like button and uses a labelled **More ⌄** dropdown.
- Keeps **Back to demos, Install, Support, DOI / Cite** visible and accessible outside the dropdown.
- Keeps **What's new** directly accessible from the atlas.
- Dropdown contains only How EnvAI works, Catalogue editor, Source catalogue and the optional Buy Me a Coffee link.
- Applies the same demo controls on the atlas, What's New and How EnvAI works pages.
- DOI / Cite explicitly says **DOI pending** if none has been assigned; it does not reuse another project's DOI.
- Supports keyboard navigation, escape to close, and responsive layouts.

## Local installation on macOS

Unzip the patch into the root of your LOCAL site checkout:

```sh
unzip -o ~/Downloads/EnvAI-visible-template-controls-patch.zip -d /Users/diandre/i_VC/salmonofdoubt.github.io
```

Start (or keep running) your local server from your checkout:

```sh
cd /Users/diandre/i_VC/salmonofdoubt.github.io
python3 -m http.server 8000
```

Open:

- http://localhost:8000/demos/envai/?header=1
- http://localhost:8000/demos/envai/whats-new.html?header=1
- http://localhost:8000/demos/envai/how-it-works.html?header=1

If an old service worker still shows cached styling, refresh with Cmd+Shift+R or clear the local EnvAI site's browser storage/service worker.

No `git commit`, `git push` or public deployment is involved.

## Files changed

- `demos/envai/index.html`
- `demos/envai/app.js`
- `demos/envai/whats-new.html`
- `demos/envai/how-it-works.html`
- `demos/envai/service-worker.js`
- `demos/envai/header-controls.css` (new)
- `demos/envai/header-secondary.js` (new)
