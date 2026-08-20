const SOFTWARE_DOI = '10.5281/zenodo.22035417';
const SOFTWARE_DOI_URL = `https://doi.org/${SOFTWARE_DOI}`;

const note = document.querySelector('.software-zenodo-note');
if (note) {
  note.innerHTML = `<strong>Sphere Machine software record:</strong> <a href="${SOFTWARE_DOI_URL}" target="_blank" rel="noopener">${SOFTWARE_DOI}</a>. This is separate from the Spherism paper DOI.`;
}

const pill = document.querySelector('[data-software-zenodo-pill]');
if (pill) {
  pill.href = SOFTWARE_DOI_URL;
  pill.target = '_blank';
  pill.rel = 'noopener';
  pill.setAttribute('aria-label', `Sphere Machine software Zenodo record ${SOFTWARE_DOI}`);
  const strong = pill.querySelector('strong');
  const span = pill.querySelector('span');
  if (strong) strong.textContent = 'Software Zenodo';
  if (span) span.textContent = SOFTWARE_DOI;
}

const referencePanel = document.getElementById('software-zenodo');
const buttonRow = referencePanel?.querySelector('.button-row');
if (buttonRow && !buttonRow.querySelector('[data-software-doi-link]')) {
  const link = document.createElement('a');
  link.className = 'button primary';
  link.dataset.softwareDoiLink = 'true';
  link.href = SOFTWARE_DOI_URL;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'Open Sphere Machine on Zenodo';
  buttonRow.prepend(link);
}
