(() => {
  'use strict';

  const CORE_VERSION = '20260910-2042';
  const VALID_LANGS = new Set(['de', 'en']);
  const ZENODO_URL = 'https://zenodo.org/records/0000000';
  let deferredInstallPrompt = null;

  function currentUrl() {
    return new URL(window.location.href);
  }

  function requestedLanguage() {
    const lang = currentUrl().searchParams.get('lang');
    return VALID_LANGS.has(lang) ? lang : 'de';
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
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement('link');
      manifest.rel = 'manifest';
      manifest.href = './manifest.webmanifest';
      document.head.appendChild(manifest);
    }

    if (!document.querySelector('link[rel="icon"]')) {
      const icon = document.createElement('link');
      icon.rel = 'icon';
      icon.href = './icon.svg';
      icon.type = 'image/svg+xml';
      document.head.appendChild(icon);
    }

    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const capable = document.createElement('meta');
      capable.name = 'apple-mobile-web-app-capable';
      capable.content = 'yes';
      document.head.appendChild(capable);
    }

    if (!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')) {
      const status = document.createElement('meta');
      status.name = 'apple-mobile-web-app-status-bar-style';
      status.content = 'black-translucent';
      document.head.appendChild(status);
    }
  }

  function installStandaloneControls() {
    const actions = document.querySelector('.hero-actions');
    if (!actions) return;

    const installButton = document.createElement('button');
    installButton.type = 'button';
    installButton.id = 'installAppButton';
    installButton.className = 'button';
    installButton.hidden = true;
    installButton.dataset.de = 'App installieren';
    installButton.dataset.en = 'Install app';
    installButton.textContent = 'App installieren';

    const zenodoLink = document.createElement('a');
    zenodoLink.className = 'button';
    zenodoLink.href = ZENODO_URL;
    zenodoLink.target = '_blank';
    zenodoLink.rel = 'noopener noreferrer';
    zenodoLink.dataset.de = 'Zenodo';
    zenodoLink.dataset.en = 'Zenodo';
    zenodoLink.textContent = 'Zenodo';

    actions.append(installButton, zenodoLink);

    installButton.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      installButton.hidden = true;
    });

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      installButton.hidden = false;
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      installButton.hidden = true;
    });

    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (standalone) installButton.hidden = true;
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
    } catch (error) {
      console.error('MeckerGesellschaft service worker registration failed.', error);
    }
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

  function activateLanguage(lang, { updateUrl = false } = {}) {
    const button = document.querySelector(`.lang-button[data-lang="${lang}"]`);
    if (!button) return;

    const alreadyActive = button.classList.contains('is-active');
    if (!alreadyActive) button.click();

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
        syncUrl(lang);
        syncDocumentMeta(lang);
      });
    });

    if (rawLang && !VALID_LANGS.has(rawLang)) {
      url.searchParams.delete('lang');
      history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }

    activateLanguage(initialLang, { updateUrl: Boolean(rawLang) });
  }

  setInitialSimulationState();
  ensurePwaMetadata();
  installStandaloneControls();
  registerServiceWorker();

  const core = document.createElement('script');
  core.src = `simulation.js?v=${CORE_VERSION}`;
  core.async = false;
  core.addEventListener('load', initialiseLanguageRouting, { once: true });
  core.addEventListener('error', () => {
    console.error('MeckerGesellschaft simulation core could not be loaded.');
  }, { once: true });
  document.head.appendChild(core);
})();
