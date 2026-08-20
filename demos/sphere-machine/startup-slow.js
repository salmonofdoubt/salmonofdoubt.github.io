// Sphere Machine startup policy: every fresh page load begins with the
// Douglas Adams sofa in Slow mode. Use the dedicated mode button when the
// enhanced controls are available so sofa selection, Slow speeds and the
// dedication all come from the same interaction path.
function startWithAdamsSofa() {
  const adamsButton = document.querySelector('[data-special="adams-sofa"]');
  if (adamsButton) {
    adamsButton.click();
    return;
  }

  // Progressive-enhancement fallback: the experiment remains usable even if
  // the streamlined controls module has not created the dedicated button.
  const shapeSelect = document.getElementById('shapeSelect');
  if (shapeSelect) {
    shapeSelect.value = 'sofa';
    shapeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  document.querySelector('[data-preset="slow"]')?.click();
}

// app.js and the controls enhancement initialise earlier in the page lifecycle.
// Waiting one animation frame avoids duplicating their setup logic.
requestAnimationFrame(startWithAdamsSofa);
