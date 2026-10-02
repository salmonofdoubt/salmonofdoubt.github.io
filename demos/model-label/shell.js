(() => {
  'use strict';
  let pending = null;
  const button = document.getElementById('installApp');
  const dialog = document.getElementById('installDialog');
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); pending = event; button.classList.add('is-ready'); });
  window.addEventListener('appinstalled', () => { pending = null; button.hidden = true; });
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) button.hidden = true;
  button.addEventListener('click', async () => {
    if (pending) { const event = pending; pending = null; await event.prompt(); return; }
    document.getElementById('installInstructions').innerHTML = /iphone|ipad|ipod/i.test(navigator.userAgent)
      ? '<p>In Safari, choose Share → Add to Home Screen.</p>'
      : '<p>Use your browser’s Install app or Add to Home Screen command. The web version remains usable if installation is unavailable.</p>';
    dialog.showModal();
  });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./service-worker.js', {scope:'./'}).catch(() => {});
})();
