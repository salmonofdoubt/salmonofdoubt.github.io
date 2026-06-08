(() => {
  const list = document.querySelector("[data-storage-flexibility-list]");
  if (!list) return;

  const source = list.getAttribute("data-storage-source") || "data/storage-flexibility.json";

  const number = new Intl.NumberFormat("en-IE");
  const money = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  });

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const metric = (label, value, unit = "") => `
    <div class="storage-watch__metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}${unit ? ` <small>${escapeHtml(unit)}</small>` : ""}</strong>
    </div>
  `;

  const renderItem = (item) => {
    const investment = item.investment_eur_bn
      ? money.format(item.investment_eur_bn * 1_000_000_000).replace(",000,000,000", "bn")
      : "TBC";

    const flags = (item.watch_flags || [])
      .map((flag) => `<li>${escapeHtml(flag)}</li>`)
      .join("");

    const sources = (item.sources || [])
      .map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)}</a>`)
      .join("");

    return `
      <article class="storage-watch__card">
        <div class="storage-watch__topline">
          <span class="storage-watch__badge">${escapeHtml(item.asset_type)}</span>
          <span class="storage-watch__status">${escapeHtml(item.status)}</span>
        </div>

        <h3>${escapeHtml(item.name)}</h3>
        <p class="storage-watch__lede">
          ${escapeHtml(item.technology)}
        </p>

        <dl class="storage-watch__facts">
          <div><dt>Developer</dt><dd>${escapeHtml(item.developer)}</dd></div>
          <div><dt>Location</dt><dd>${escapeHtml(item.location)}</dd></div>
          <div><dt>Planning ref.</dt><dd>${escapeHtml(item.planning_reference)}</dd></div>
          <div><dt>Counting rule</dt><dd>${escapeHtml(item.counting_rule)}</dd></div>
        </dl>

        <div class="storage-watch__metrics" aria-label="Project metrics">
          ${metric("Capacity", number.format(item.capacity_mw), "MW")}
          ${metric("Duration", number.format(item.duration_hours), "hours")}
          ${metric("Stored energy", number.format(item.energy_gwh), "GWh")}
          ${metric("Investment", investment)}
        </div>

        <div class="storage-watch__checks">
          <h4>Monitor checks</h4>
          <ul>${flags}</ul>
        </div>

        <div class="storage-watch__sources">
          ${sources}
        </div>
      </article>
    `;
  };

  fetch(source, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`Storage watch data failed: ${response.status}`);
      return response.json();
    })
    .then((data) => {
      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) {
        list.innerHTML = `<p class="storage-watch__empty">No storage flexibility projects are currently listed.</p>`;
        return;
      }

      list.innerHTML = items.map(renderItem).join("");

      const terms = document.querySelector("[data-storage-query-terms]");
      if (terms && Array.isArray(data.query_terms)) {
        terms.innerHTML = data.query_terms
          .map((term) => `<span>${escapeHtml(term)}</span>`)
          .join("");
      }
    })
    .catch((error) => {
      console.error(error);
      list.innerHTML = `
        <p class="storage-watch__empty">
          Storage flexibility data could not be loaded. Check data/storage-flexibility.json.
        </p>
      `;
    });
})();
