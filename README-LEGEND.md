# EnvAI fixed colour key — local/public patch

The colour key is now docked inside the fixed bottom status rail, not on top of the map. On narrow screens it wraps beneath the selected tool details inside the rail. It is visible only when a selection is active. The four existing classification colours and methodology help link are unchanged.

From your repository root:

```sh
unzip -o ~/Downloads/EnvAI-fixed-legend-patch.zip -d /Users/diandre/i_VC/salmonofdoubt.github.io
cd /Users/diandre/i_VC/salmonofdoubt.github.io
python3 -m http.server 8000
```

Open http://localhost:8000/demos/envai/?legend=docked and select any cluster or tool. If you had EnvAI open already, force-refresh with Cmd+Shift+R.

This patch changes only demos/envai/index.html, app.js, styles.css, and service-worker.js. It does not alter the tools catalogue, daily update workflow, news feed, or other demos. No changes are pushed by installing it.

After checking the local version:

```sh
git add demos/envai/index.html demos/envai/app.js demos/envai/styles.css demos/envai/service-worker.js
git diff --cached --check
git diff --cached --stat
git commit -m "Dock EnvAI classification legend in bottom rail"
git push origin master
```
