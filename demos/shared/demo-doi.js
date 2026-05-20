(function () {
  const placeholderDoi = "10.5281/zenodo.0000000";
  const path = window.location.pathname.replace(/\/index\.html$/, "/");

  // Do not show the DOI pill on the demos index itself.
  if (path === "/demos/" || path.endsWith("/demos/")) return;

  if (document.querySelector("[data-demo-doi-pill]")) return;

  function normalise(value) {
    return String(value || "").trim();
  }

  function isRealZenodoDoi(value) {
    const match = normalise(value).match(/^10\.5281\/zenodo\.(\d+)$/);
    if (!match) return false;
    return !/^0+$/.test(match[1]);
  }

  function currentDemoFromManifest(demos) {
    const candidates = demos
      .filter(demo => demo && demo.path)
      .map(demo => {
        const demoPath = `/demos/${String(demo.path).replace(/^\/+/, "")}`;
        return { demo, demoPath };
      })
      .filter(entry => path.startsWith(entry.demoPath))
      .sort((a, b) => b.demoPath.length - a.demoPath.length);

    return candidates.length ? candidates[0].demo : null;
  }

  function makePill(doi) {
    const value = normalise(doi) || placeholderDoi;
    const real = isRealZenodoDoi(value);

    const node = document.createElement(real ? "a" : "span");
    node.className = real ? "demo-doi-pill" : "demo-doi-pill is-pending";
    node.setAttribute("data-demo-doi-pill", "true");
    node.textContent = value;

    if (real) {
      node.href = `https://doi.org/${value}`;
      node.target = "_blank";
      node.rel = "noopener";
      node.setAttribute("aria-label", `Open DOI ${value}`);
      node.title = `Open DOI ${value}`;
    } else {
      node.setAttribute("aria-label", `DOI placeholder ${placeholderDoi}`);
      node.title = "DOI pending";
    }

    return node;
  }

  async function init() {
    try {
      const response = await fetch("/demos/data/demos.json?v=" + Date.now());
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = await response.json();
      const demos = Array.isArray(payload) ? payload : payload.demos;
      if (!Array.isArray(demos)) return;

      const demo = currentDemoFromManifest(demos);
      if (!demo) return;

      document.body.appendChild(makePill(demo.doi || placeholderDoi));
    } catch (error) {
      console.warn("Could not load DOI metadata", error);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
