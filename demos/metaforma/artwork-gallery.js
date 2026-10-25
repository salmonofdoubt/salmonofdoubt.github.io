(() => {
  'use strict';
  /* MetaForma plate loader. A plate is displayed only if its exact original asset exists.
     Local previews do not upload artwork and never imply instructor approval. */
  const plates = [...document.querySelectorAll('[data-artwork-status="staged"]')];
  const localInput = document.getElementById('artworkLocalFiles');
  const feedback = document.getElementById('artworkLocalFeedback');
  const localObjectUrls = new Map();
  const delivered = new Set();

  function show(figure, url, isLocal) {
    const image = figure.querySelector('img');
    const anchor = figure.querySelector('.artwork-zoom');
    const note = figure.querySelector('.artwork-note');
    const visible = figure.querySelector('.artwork-visible-note');
    if (!image || !anchor || !note) return;
    if (!isLocal) {
      // Reject missing website assets without leaving a broken image on screen.
      const probe = new Image();
      probe.onload = () => {
        image.src = url;
        anchor.href = url;
        anchor.hidden = false;
        note.hidden = true;
        if (visible) visible.hidden = false;
        delivered.add(figure.dataset.artworkNumber);
      };
      probe.onerror = () => { /* File not on GitHub yet: retain the honest staging note. */ };
      probe.src = url;
      return;
    }
    image.src = url;
    anchor.href = url;
    anchor.hidden = false;
    anchor.target = '_blank';
    note.hidden = true;
    if (visible) visible.hidden = false;
  }

  const basename = name => String(name || '').split(/[\\/]/).pop().toLowerCase().normalize('NFKD');
  function matchNumber(name) {
    const v = basename(name);
    // Accept numbered files for all received or reserved Forms 01–14.
    const numbered = v.match(/^(?:form[_ -])?(0[1-9]|1[0-4])(?:[_ .-]|$)/i);
    if (numbered) return numbered[1];
    // The four Block I Gemini images are intentionally not inferred by filename:
    // artist must use 01, 02, 03, 04 names to avoid switching movements.
    return null;
  }

  for (const figure of plates) {
    const el = figure.querySelector('[data-artwork-src]');
    if (el) show(figure, el.dataset.artworkSrc, false);
  }

  if (localInput) localInput.addEventListener('change', () => {
    let count = 0;
    for (const file of Array.from(localInput.files || [])) {
      if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) continue;
      const id = matchNumber(file.name);
      const figure = plates.find(p => p.dataset.artworkNumber === id);
      if (!figure) continue;
      if (localObjectUrls.has(id)) URL.revokeObjectURL(localObjectUrls.get(id));
      const url = URL.createObjectURL(file);
      localObjectUrls.set(id,url);
      show(figure,url,true);
      count += 1;
    }
    if (feedback) feedback.textContent = count
      ? count + ' plates visible on this device only. Nothing has been uploaded to the public website.'
      : 'No matching form numbers. Choose images named 01–14 (e.g. Form_10_Cork_Screw.png or 10.png).';
    localInput.value = '';
  });
  window.addEventListener('pagehide', () => { for (const url of localObjectUrls.values()) URL.revokeObjectURL(url); });
})();
