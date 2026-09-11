(() => {
  'use strict';

  let deferredInstallPrompt = null;
  const installButton = document.getElementById('installApp');
  const installDialog = document.getElementById('installDialog');
  const installInstructions = document.getElementById('installInstructions');
  const doiPill = document.getElementById('doiPill');
  const doiText = document.getElementById('doiText');
  const config = window.DEMO_TEMPLATE_CONFIG || {
    doi: '10.5281/zenodo.0000000',
    doiUrl: 'https://zenodo.org/records/0000000'
  };

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function configureDoi() {
    if (!doiPill || !doiText) return;
    doiText.textContent = config.doi;
    doiPill.href = config.doiUrl || 'https://zenodo.org/records/0000000';
    doiPill.classList.toggle('is-placeholder', config.doi.includes('0000000'));
    doiPill.title = config.doi.includes('0000000') ? 'Zenodo placeholder record' : `Open Zenodo DOI ${config.doi}`;
  }

  function showInstallInstructions() {
    if (!installDialog || !installInstructions) return;
    const ua = navigator.userAgent || '';
    const apple = /iphone|ipad|ipod/i.test(ua);
    const android = /android/i.test(ua);

    installInstructions.innerHTML = apple
      ? '<p>In Safari, tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.</p><ol><li>Open this page in Safari.</li><li>Tap the Share icon.</li><li>Choose “Add to Home Screen”, then confirm.</li></ol>'
      : android
        ? '<p>Open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>'
        : '<p>Use the install icon in your browser’s address bar, or open the browser menu and choose <strong>Install app</strong>.</p><p>The web version remains fully usable if installation is unavailable.</p>';

    if (typeof installDialog.showModal === 'function') installDialog.showModal();
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

  function initialiseInstall() {
    if (!installButton) return;
    if (isStandalone()) installButton.hidden = true;

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      installButton.hidden = false;
      installButton.classList.add('is-ready');
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      installButton.hidden = true;
    });

    installButton.addEventListener('click', requestInstall);
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') return;
    try {
      await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
    } catch (error) {
      console.warn('Demo Template service worker registration failed:', error);
    }
  }

  configureDoi();
  initialiseInstall();
  registerServiceWorker();
})();
