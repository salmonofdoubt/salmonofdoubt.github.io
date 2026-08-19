const head = document.head;

if (!head.querySelector('link[rel="manifest"]')) {
  const manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = './manifest.webmanifest';
  head.appendChild(manifest);
}

if (!head.querySelector('link[rel="apple-touch-icon"]')) {
  const appleIcon = document.createElement('link');
  appleIcon.rel = 'apple-touch-icon';
  appleIcon.href = './icon-192.png';
  head.appendChild(appleIcon);
}

const appleCapable = document.createElement('meta');
appleCapable.name = 'apple-mobile-web-app-capable';
appleCapable.content = 'yes';
head.appendChild(appleCapable);

const appleStatus = document.createElement('meta');
appleStatus.name = 'apple-mobile-web-app-status-bar-style';
appleStatus.content = 'black-translucent';
head.appendChild(appleStatus);

const appleTitle = document.createElement('meta');
appleTitle.name = 'apple-mobile-web-app-title';
appleTitle.content = 'Sphere Machine';
head.appendChild(appleTitle);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(error => {
      console.warn('Sphere Machine service worker registration failed:', error);
    });
  });
}

let deferredInstallPrompt = null;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

function platformHint() {
  const ua = navigator.userAgent;
  const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMac = /Macintosh|Mac OS X/.test(ua);
  if (isiOS) return 'On iPhone or iPad, use Share → Add to Home Screen.';
  if (isMac) return 'Use your browser’s Install App or Add to Dock command.';
  return 'Use your browser’s Install App or Add to Home Screen command.';
}

function installButton() {
  if (isStandalone || document.querySelector('[data-sphere-install]')) return null;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sphere-install-pill';
  button.dataset.sphereInstall = 'true';
  button.textContent = 'Install app';
  button.setAttribute('aria-label', 'Install Sphere Machine on this device');

  const style = document.createElement('style');
  style.textContent = `
    .sphere-install-pill {
      position: fixed;
      left: 16px;
      bottom: 58px;
      z-index: 9998;
      min-height: 36px;
      padding: .48rem .72rem;
      border: 1px solid rgba(24,198,216,.42);
      border-radius: 999px;
      background: rgba(5,12,18,.88);
      color: #e9f8f8;
      box-shadow: 0 10px 28px rgba(0,0,0,.28);
      backdrop-filter: blur(12px);
      font: 800 .76rem/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      cursor: pointer;
    }
    .sphere-install-pill:hover,
    .sphere-install-pill:focus-visible {
      background: linear-gradient(135deg,#18c6d8,#91fff2);
      color: #031014;
      outline: none;
    }
    @media (max-width: 620px) {
      .sphere-install-pill { left: 10px; bottom: 52px; min-height: 34px; font-size: .7rem; }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(button);
  return button;
}

const button = installButton();

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

button?.addEventListener('click', async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    return;
  }
  window.alert(platformHint());
});

window.addEventListener('appinstalled', () => button?.remove());
