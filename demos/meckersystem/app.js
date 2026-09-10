(() => {
  'use strict';

  const CORE_VERSION = '20260910-2042';
  const VALID_LANGS = new Set(['de', 'en']);
  let deferredInstallPrompt = null;

  function currentUrl() { return new URL(window.location.href); }
  function requestedLanguage() {
    const lang = currentUrl().searchParams.get('lang');
    return VALID_LANGS.has(lang) ? lang : 'de';
  }

  function loadSiteConfig() {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = './site-config.js';
      script.onload = resolve;
      script.onerror = resolve;
      document.head.appendChild(script);
    });
  }

  function config() {
    return window.MECKER_SITE_CONFIG || { doi: '10.5281/zenodo.0000000', doiUrl: '' };
  }

  function setInitialSimulationState() {
    const clusterControl = document.getElementById('clusterTotal');
    const clusterOutput = document.getElementById('clusterTotalOut');
    const activeClusters = document.getElementById('activeClusters');
    if (clusterControl) clusterControl.value = '1';
    if (clusterOutput) clusterOutput.value = '1';
    if (activeClusters) activeClusters.textContent = '0/1';
  }

  function ensurePwaMetadata() {
    const addLink = (rel, href, type) => {
      if (document.querySelector(`link[rel="${rel}"]`)) return;
      const link = document.createElement('link');
      link.rel = rel; link.href = href; if (type) link.type = type;
      document.head.appendChild(link);
    };
    addLink('manifest', './manifest.webmanifest');
    addLink('icon', './icon.svg', 'image/svg+xml');
    addLink('stylesheet', './pwa-ui.css?v=20260910-2208');

    const addMeta = (name, content) => {
      if (document.querySelector(`meta[name="${name}"]`)) return;
      const meta = document.createElement('meta'); meta.name = name; meta.content = content; document.head.appendChild(meta);
    };
    addMeta('mobile-web-app-capable', 'yes');
    addMeta('apple-mobile-web-app-capable', 'yes');
    addMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
    addMeta('apple-mobile-web-app-title', 'MeckerGesellschaft');
  }

  function isStandaloneDisplay() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function buildEnvLensStyleUtilityUi() {
    const heroTools = document.querySelector('.hero-tools');
    if (!heroTools) return;

    const installButton = document.createElement('button');
    installButton.type = 'button';
    installButton.id = 'installApp';
    installButton.className = 'install-button';
    installButton.innerHTML = '<span aria-hidden="true">↓</span><span class="install-label" data-de="Installieren" data-en="Install">Installieren</span>';
    heroTools.prepend(installButton);

    const dialog = document.createElement('dialog');
    dialog.className = 'install-dialog';
    dialog.id = 'installDialog';
    dialog.innerHTML = `
      <form method="dialog">
        <button class="dialog-close" type="submit" value="close" aria-label="Close">×</button>
        <p class="eyebrow" data-de="Installierbare Web-App" data-en="Installable web app">Installierbare Web-App</p>
        <h2 data-de="MeckerGesellschaft auf diesem Gerät behalten." data-en="Keep Grumble Society on this device.">MeckerGesellschaft auf diesem Gerät behalten.</h2>
        <div id="installInstructions" class="install-instructions"></div>
        <div class="dialog-actions"><button class="button primary" type="submit" value="close" data-de="Verstanden" data-en="Got it">Verstanden</button></div>
      </form>`;
    document.body.appendChild(dialog);

    const doiPill = document.createElement('a');
    doiPill.className = 'doi-pill';
    doiPill.id = 'doiPill';
    doiPill.innerHTML = `<b>DOI</b><span id="doiText"></span>`;
    document.body.appendChild(doiPill);

    configureDoi();
    initialiseInstallExperience();
  }

  function configureDoi() {
    const c = config();
    const pill = document.getElementById('doiPill');
    const textNode = document.getElementById('doiText');
    if (!pill || !textNode) return;
    textNode.textContent = c.doi;
    const hasRealDoi = Boolean(c.doiUrl) && !c.doi.includes('0000000');
    if (hasRealDoi) {
      pill.href = c.doiUrl;
      pill.target = '_blank';
      pill.rel = 'noopener noreferrer';
      pill.setAttribute('aria-label', `Open Zenodo DOI ${c.doi}`);
      return;
    }
    pill.href = 'https://zenodo.org/records/0000000';
    pill.target = '_blank';
    pill.rel = 'noopener noreferrer';
    pill.classList.add('is-placeholder');
    pill.title = 'Zenodo DOI placeholder';
    pill.setAttribute('aria-label', `Zenodo DOI placeholder ${c.doi}`);
  }

  function showInstallInstructions() {
    const lang = requestedLanguage();
    const ua = navigator.userAgent || '';
    const apple = /iphone|ipad|ipod/i.test(ua);
    const android = /android/i.test(ua);
    const box = document.getElementById('installInstructions');
    if (!box) return;

    if (lang === 'de') {
      box.innerHTML = apple
        ? '<p>In Safari auf <strong>Teilen</strong> tippen und dann <strong>Zum Home-Bildschirm</strong> wählen.</p><ol><li>Diese Seite in Safari öffnen.</li><li>Auf das Teilen-Symbol tippen.</li><li>„Zum Home-Bildschirm“ wählen und bestätigen.</li></ol>'
        : android
          ? '<p>Browser-Menü öffnen und <strong>App installieren</strong> oder <strong>Zum Startbildschirm hinzufügen</strong> wählen.</p>'
          : '<p>Das Installationssymbol in der Adressleiste verwenden oder im Browser-Menü <strong>MeckerGesellschaft installieren</strong> wählen.</p><p>Die Web-Version bleibt vollständig nutzbar, wenn Installation nicht angeboten wird.</p>';
    } else {
      box.innerHTML = apple
        ? '<p>In Safari, tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.</p><ol><li>Open this page in Safari.</li><li>Tap the Share icon.</li><li>Choose “Add to Home Screen”, then confirm.</li></ol>'
        : android
          ? '<p>Open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>'
          : '<p>Use the install icon in your browser’s address bar, or open the browser menu and choose <strong>Install Grumble Society</strong>.</p><p>The web version remains fully usable when installation is unavailable.</p>';
    }

    const dialog = document.getElementById('installDialog');
    if (typeof dialog?.showModal === 'function') dialog.showModal();
    else dialog?.setAttribute('open', '');
  }

  async function requestInstall() {
    if (isStandaloneDisplay()) {
      showInstallInstructions();
      return;
    }
    if (!deferredInstallPrompt) {
      showInstallInstructions();
      return;
    }
    const promptEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;
    await promptEvent.prompt();
    await promptEvent.userChoice;
  }

  function initialiseInstallExperience() {
    const button = document.getElementById('installApp');
    if (!button) return;
    if (isStandaloneDisplay()) button.hidden = true;

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      button.hidden = false;
      button.classList.add('is-ready');
    });
    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      button.hidden = true;
    });
    button.addEventListener('click', requestInstall);
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') return;
    try { await navigator.serviceWorker.register('./service-worker.js', { scope: './' }); }
    catch (error) { console.warn('Offline shell registration failed:', error); }
  }

  function syncUrl(lang) {
    if (!VALID_LANGS.has(lang)) return;
    const url = currentUrl();
    url.searchParams.set('lang', lang);
    history.replaceState({ lang }, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function syncDocumentMeta(lang) {
    document.title = lang === 'en' ? 'Grumble Society · Emergence Lab | André Baumann' : 'MeckerGesellschaft · Emergence Lab | André Baumann';
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = lang === 'en'
      ? 'Interactive agent-based emergence simulation: multiple grumble clusters interact through local networks, spillover, feedback, and autonomous or manual grumble export.'
      : 'Interaktive Agenten-Simulation zu Emergenz: mehrere MeckerCluster koppeln lokale MeckerSysteme und Na-wird-schon-Systeme über Netzwerke, Überschwappen und autonomen oder manuellen Meckerexport.';
  }

  function activateLanguage(lang, { updateUrl = false } = {}) {
    const button = document.querySelector(`.lang-button[data-lang="${lang}"]`);
    if (!button) return;
    if (!button.classList.contains('is-active')) button.click();
    syncDocumentMeta(lang);
    if (updateUrl) syncUrl(lang);
  }

  function initialiseLanguageRouting() {
    const url = currentUrl();
    const rawLang = url.searchParams.get('lang');
    const initialLang = requestedLanguage();
    document.querySelectorAll('.lang-button').forEach((button) => {
      button.addEventListener('click', () => {
        const lang = VALID_LANGS.has(button.dataset.lang) ? button.dataset.lang : 'de';
        syncUrl(lang); syncDocumentMeta(lang);
      });
    });
    if (rawLang && !VALID_LANGS.has(rawLang)) {
      url.searchParams.delete('lang');
      history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
    activateLanguage(initialLang, { updateUrl: Boolean(rawLang) });
  }

  async function boot() {
    setInitialSimulationState();
    ensurePwaMetadata();
    await loadSiteConfig();
    buildEnvLensStyleUtilityUi();
    registerServiceWorker();

    const core = document.createElement('script');
    core.src = `simulation.js?v=${CORE_VERSION}`;
    core.async = false;
    core.addEventListener('load', initialiseLanguageRouting, { once: true });
    core.addEventListener('error', () => console.error('MeckerGesellschaft simulation core could not be loaded.'), { once: true });
    document.head.appendChild(core);
  }

  boot();
})();
