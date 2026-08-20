// Sphere Machine startup policy: begin with the sofa as the opening example,
// while keeping Slow mode as the experiment default. The sofa is not a separate
// conceptual mode; users can switch to simpler forms from the object selector.
function startWithSofa() {
  const shapeSelect = document.getElementById('shapeSelect');
  if (shapeSelect) {
    shapeSelect.value = 'sofa';
    shapeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  document.querySelector('[data-preset="slow"]')?.click();
}

requestAnimationFrame(startWithSofa);
