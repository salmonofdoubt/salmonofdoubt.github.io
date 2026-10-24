(() => {
  'use strict';
  const button = document.getElementById('installApp');
  const dialog = document.getElementById('installDialog');
  const instructions = document.getElementById('installInstructions');
  let pendingInstallPrompt = null;

  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  function showInstructions() {
    const ua = navigator.userAgent || '';
    const ios = /iPhone|iPad|iPod/i.test(ua);
    const android = /Android/i.test(ua);
    const message = ios
      ? '<p>In Safari, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</p>'
      : android
        ? '<p>Open your browser menu and select <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>'
        : '<p>Look for <strong>Install app</strong> in the address bar or browser menu. If unavailable, keep using the web version; manual installation support varies by browser.</p>';
    if (instructions) instructions.innerHTML = message;
    if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
    else if (instructions) alert(instructions.textContent);
  }

  if (button) {
    if (isStandalone()) button.hidden = true;
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      pendingInstallPrompt = event;
      button.classList.add('is-ready');
    });
    window.addEventListener('appinstalled', () => {
      pendingInstallPrompt = null;
      button.hidden = true;
    });
    button.addEventListener('click', async () => {
      if (!pendingInstallPrompt) { showInstructions(); return; }
      const event = pendingInstallPrompt;
      pendingInstallPrompt = null;
      button.classList.remove('is-ready');
      try {
        await event.prompt();
        await event.userChoice;
      } catch (error) {
        console.warn('MetaForma install prompt not available:', error);
        showInstructions();
      }
    });
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js', { scope: './' })
        .catch(error => console.warn('MetaForma offline shell registration failed:', error));
    });
  }
})();
