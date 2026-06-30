function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const dialog = document.getElementById("work-lightbox");

if (dialog) {
  const image = document.getElementById("lightbox-image");
  const title = document.getElementById("lightbox-title");
  const meta = document.getElementById("lightbox-meta");
  const text = document.getElementById("lightbox-text");
  const reading = document.getElementById("lightbox-reading");
  const source = document.getElementById("lightbox-source");
  const close = dialog.querySelector(".lightbox-close");

  document.querySelectorAll(".work-card, .lead-link").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!dialog.showModal) return;

      event.preventDefault();

      image.src = link.href;
      image.alt = link.dataset.title || "";
      title.textContent = link.dataset.title || "";
      meta.textContent = link.dataset.meta || "";
      text.textContent = link.dataset.text || "";
      reading.innerHTML = link.dataset.reading
        ? `<strong>Reading:</strong> ${escapeHtml(link.dataset.reading)}`
        : "";

      source.innerHTML = link.dataset.source
        ? `<a class="text-link" href="${escapeHtml(link.dataset.source)}" target="_blank" rel="noopener">Original archive image</a>`
        : "";

      dialog.showModal();
      close.focus();
    });
  });

  close.addEventListener("click", () => dialog.close());

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}
