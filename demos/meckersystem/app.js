(() => {
  'use strict';

  const CORE_VERSION = '20260910-1848';
  const VALID_LANGS = new Set(['de', 'en']);

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

  const core = document.createElement('script');
  core.src = `simulation.js?v=${CORE_VERSION}`;
  core.async = false;
  core.addEventListener('load', initialiseLanguageRouting, { once: true });
  core.addEventListener('error', () => {
    console.error('MeckerGesellschaft simulation core could not be loaded.');
  }, { once: true });
  document.head.appendChild(core);
})();
