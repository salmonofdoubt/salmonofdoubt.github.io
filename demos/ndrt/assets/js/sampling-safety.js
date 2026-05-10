// Seasonal CSSI / kick-sampling safety helper
// Highlights the current month and updates the status badge on the NDRT citizen-science page.

(function () {
  const monthIndex = new Date().getMonth();
  const monthItems = Array.from(document.querySelectorAll('[data-sampling-month]'));
  const statusBadge = document.querySelector('[data-current-sampling-status]');

  if (!monthItems.length || !statusBadge) return;

  const currentItem = monthItems.find((item) => Number(item.dataset.monthIndex) === monthIndex);
  if (!currentItem) return;

  currentItem.classList.add('is-current');
  currentItem.setAttribute('aria-current', 'date');

  const status = currentItem.dataset.status || 'amber';
  const label = currentItem.dataset.statusLabel || 'Use caution';

  statusBadge.textContent = `Current month: ${label}`;
  statusBadge.classList.remove('status-red', 'status-amber', 'status-green');
  statusBadge.classList.add(`status-${status}`);
})();
