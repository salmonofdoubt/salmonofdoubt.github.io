// Sphere Machine startup policy: every fresh page load begins in Slow mode.
// Apply through the existing preset button so one source of truth controls
// axis state, speeds, active-button styling, accumulated observations and labels.
function startInSlowMode() {
  const slowButton = document.querySelector('[data-preset="slow"]');
  if (!slowButton) return;
  slowButton.click();
}

// app.js is the preceding module on the page. Waiting until the next frame
// guarantees its controls and event listeners are fully initialised first.
requestAnimationFrame(startInSlowMode);
