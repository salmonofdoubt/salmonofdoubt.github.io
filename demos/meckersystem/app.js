(() => {
  'use strict';

  const CORE_VERSION = '20260910-2315';
  const VALID_LANGS = new Set(['de', 'en']);
  let deferredInstallPrompt = null;

  function currentUrl() {
    return new URL(window.location.href);
  }

  function requestedLanguage() {
    const lang = currentUrl().searchParams.get('lang');
    return VALID_LANGS.has(lang) ? lang : 'de';
  }

  function config() {
    return window.MECKER_SITE_CONFIG || { doi: '10.5281/zenodo.0000000', doiUrl: '' };
  }

  function isStandaloneDisplay() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function syncUrl(lang) {
    if (!VALID_LANGS.has(lang)) return;
    const url = currentUrl();
    url.searchParams.set('lang', lang);
    history.replaceState({ lang }, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function syncDocumentMeta(lang) {
    document.title = lang === 'en'
      ? 'Grumble Society · Emergence Lab | André Baumann'
      : 'MeckerGesellschaft · Emergence Lab | André Baumann';

    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.content = lang === 'en'
        ? 'Interactive agent-based emergence simulation: multiple grumble clusters interact through local networks, spillover, feedback, and autonomous or manual grumble export.'
        : 'Interaktive Agenten-Simulation zu Emergenz: mehrere MeckerCluster koppeln lokale MeckerSysteme und Na-wird-schon-Systeme über Netzwerke, Überschwappen und autonomen oder manuellen Meckerexport.';
    }
  }

  function configureDoi() {
    const c = config();
    const doi = document.getElementById('doiPill');
    const text = document.getElementById('doiText');
    if (!doi || !text) return;

    text.textContent = c.doi;
    const hasRealDoi = Boolean(c.doiUrl) && !c.doi.includes('0000000');

    if (hasRealDoi) {
      doi.href = c.doiUrl;
      doi.classList.remove('is-placeholder');
      doi.setAttribute('aria-label', `Open Zenodo DOI ${c.doi}`);
      return;
    }

    doi.href = '#';
    doi.classList.add('is-placeholder');
    doi.title = 'Zenodo DOI will be added after publication.';
    doi.setAttribute('aria-label', `Zenodo DOI placeholder ${c.doi}`);
    doi.addEventListener('click', (event) => event.preventDefault());
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
  }

  async function requestInstall() {
    if (!deferredInstallPrompt) {
      showInstallInstructions();
      return;
    }

    const promptEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;
    promptEvent.prompt();
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
    try {
      await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
    } catch (error) {
      console.warn('Offline shell registration failed:', error);
    }
  }

  function initialiseLanguageRouting() {
    const url = currentUrl();
    const rawLang = url.searchParams.get('lang');
    const initialLang = requestedLanguage();

    document.querySelectorAll('.lang-button').forEach((button) => {
      button.addEventListener('click', () => {
        const lang = VALID_LANGS.has(button.dataset.lang) ? button.dataset.lang : 'de';
        syncUrl(lang);
        syncDocumentMeta(lang);
      });
    });

    if (rawLang && !VALID_LANGS.has(rawLang)) {
      url.searchParams.delete('lang');
      history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }

    const button = document.querySelector(`.lang-button[data-lang="${initialLang}"]`);
    if (button && !button.classList.contains('is-active')) button.click();
    syncDocumentMeta(initialLang);
  }

  function loadSimulation() {
    const core = document.createElement('script');
    core.src = `simulation.js?v=${CORE_VERSION}`;
    core.async = false;
    core.addEventListener('load', initialiseLanguageRouting, { once: true });
    core.addEventListener('error', () => console.error('MeckerGesellschaft simulation core could not be loaded.'), { once: true });
    document.head.appendChild(core);
  }

  configureDoi();
  initialiseInstallExperience();
  registerServiceWorker();
  loadSimulation();
})();
