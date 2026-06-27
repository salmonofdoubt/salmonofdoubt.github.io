export function installShareButton(button) {
  if (!button) return;

  const original = button.textContent;

  button.addEventListener("click", async () => {
    const shareData = {
      title: document.title,
      text: "Explore live and latest Irish water-quality signals.",
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(window.location.href);
      button.textContent = "Copied";
      window.setTimeout(() => button.textContent = original, 1400);
    } catch (error) {
      window.prompt("Copy this link", window.location.href);
    }
  });
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function deviceType() {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  if (/iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function installPwaButton(button) {
  if (!button) return;

  const defaultLabel = "Install";
  let deferredInstallPrompt = null;

  function flash(label) {
    button.textContent = label;
    window.setTimeout(() => button.textContent = defaultLabel, 2200);
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    button.textContent = "Installed";
  });

  button.addEventListener("click", async () => {
    if (isStandalone()) {
      flash("Installed");
      return;
    }

    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      try {
        await deferredInstallPrompt.userChoice;
      } finally {
        deferredInstallPrompt = null;
      }
      return;
    }

    const type = deviceType();
    if (type === "ios") flash("Share → Add");
    else if (type === "android") flash("Menu → Install");
    else flash("Browser menu");
  });
}
