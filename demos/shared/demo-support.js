(function () {
  const githubSponsorUrl = "https://github.com/sponsors/salmonofdoubt";
  const coffeeUrl = "https://buymeacoffee.com/andrecbaum1";
  const path = window.location.pathname.replace(/\/index\.html$/, "/");
  const isSphereMachine = path.endsWith("/demos/sphere-machine/");

  // Show on both the demos index and individual demo pages.
  // DOI and return controls remain separate and still skip the demos index.

  function installSphereMachinePolish() {
    if (!isSphereMachine) return;

    if (!document.querySelector('link[data-sphere-polish]')) {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = '/demos/sphere-machine/polish.css?v=20260819-1';
      stylesheet.dataset.spherePolish = 'true';
      document.head.appendChild(stylesheet);
    }

    const hero = document.querySelector('.compact-hero');
    const heroCopy = hero?.querySelector('.hero-copy');
    const premise = hero?.querySelector('.compact-premise');
    const lead = heroCopy?.querySelector('.lead');
    const truthStrip = heroCopy?.querySelector('.truth-strip');

    if (hero) hero.classList.add('intro-hero');
    if (premise) premise.remove();

    if (lead) {
      lead.innerHTML = 'Look at an object from one point. Then another. Now imagine an octopus wrapping sensor-covered arms around it — and finally, every possible viewpoint at once. Superimpose those observations and the privileged edges fade toward a sphere-like limit. <strong>What would anything look like if no single perspective were allowed to dominate?</strong>';
    }

    if (truthStrip) {
      truthStrip.innerHTML = '<span>perspective → superposition</span><span>superposition → probability</span><span>probability → quantum comparison</span>';
    }

    if (heroCopy && !heroCopy.querySelector('.intro-route')) {
      const route = document.createElement('p');
      route.className = 'intro-route';
      route.textContent = 'Rotate it. Watch the observations accumulate. Compare the finite view with the rotational limit — then follow the same language of symmetry and probability into quantum mechanics.';
      heroCopy.appendChild(route);
    }

    const referencePanel = document.querySelector('.reference-panel');
    if (referencePanel) {
      referencePanel.id = 'software-zenodo';
      if (!referencePanel.querySelector('.software-zenodo-note')) {
        const note = document.createElement('p');
        note.className = 'software-zenodo-note';
        note.innerHTML = '<strong>Sphere Machine software record:</strong> Zenodo DOI pending. This is separate from the Spherism paper DOI.';
        const buttons = referencePanel.querySelector('.button-row');
        referencePanel.insertBefore(note, buttons || null);
      }
    }

    if (!document.querySelector('[data-software-zenodo-pill]')) {
      const zenodo = document.createElement('a');
      zenodo.className = 'software-zenodo-pill';
      zenodo.href = '#software-zenodo';
      zenodo.dataset.softwareZenodoPill = 'true';
      zenodo.setAttribute('aria-label', 'Sphere Machine software Zenodo record, DOI pending');
      zenodo.innerHTML = '<strong>Software Zenodo</strong><span>DOI pending</span>';
      document.body.appendChild(zenodo);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    installSphereMachinePolish();

    if (document.querySelector("[data-demo-support-widget]")) return;

    const widget = document.createElement("div");
    widget.className = "demo-support-widget";
    widget.setAttribute("data-demo-support-widget", "true");

    const button = document.createElement("button");
    button.className = "demo-support-pill";
    button.type = "button";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "demo-support-menu");
    button.textContent = "Support this work";

    const menu = document.createElement("div");
    menu.className = "demo-support-menu";
    menu.id = "demo-support-menu";

    const github = document.createElement("a");
    github.className = "demo-support-option";
    github.href = githubSponsorUrl;
    github.target = "_blank";
    github.rel = "noopener";
    github.innerHTML = "<strong>GitHub Sponsors</strong><span>Best for open-source and civic-tech support.</span>";

    const coffee = document.createElement("a");
    coffee.className = "demo-support-option coffee";
    coffee.href = coffeeUrl;
    coffee.target = "_blank";
    coffee.rel = "noopener";
    coffee.innerHTML = "<strong>Buy Me a Coffee</strong><span>Quick support for friends and casual visitors.</span>";

    menu.append(github, coffee);
    widget.append(menu, button);
    document.body.appendChild(widget);

    function closeWidget() {
      widget.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
    }

    function openWidget() {
      widget.classList.add("is-open");
      button.setAttribute("aria-expanded", "true");
    }

    button.addEventListener("click", function (event) {
      event.stopPropagation();
      if (widget.classList.contains("is-open")) closeWidget();
      else openWidget();
    });

    document.addEventListener("click", function (event) {
      if (!widget.contains(event.target)) closeWidget();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeWidget();
        button.blur();
      }
    });
  });
})();