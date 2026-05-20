const DATA_URL = './data/funds.json';
const HISTORY_URL = './data/history.json';

const state = {
  data: null,
  history: null,
  query: '',
  sort: 'display_name',
  showMissing: true,
};

const fmt = new Intl.DateTimeFormat('en-IE', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function byId(id) {
  return document.getElementById(id);
}

function pct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const number = Number(value);
  return `${number > 0 ? '+' : ''}${number.toFixed(2)}%`;
}

function safeText(value) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function statusLabel(fund) {
  return fund.status === 'ok' ? 'Public row found' : 'Missing public row';
}

function statusClass(fund) {
  return fund.status === 'ok' ? 'ok' : 'warn';
}

function perf(fund, key) {
  return fund.performance ? fund.performance[key] : null;
}

function filteredFunds() {
  const data = state.data?.funds || [];
  const q = state.query.trim().toLowerCase();
  let funds = data.filter((fund) => {
    if (!state.showMissing && fund.status !== 'ok') return false;
    if (!q) return true;
    const haystack = [fund.display_name, fund.source_name, fund.status, fund.note]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  funds = funds.sort((a, b) => {
    if (state.sort === 'one_year' || state.sort === 'since_launch') {
      return (perf(b, state.sort) ?? -Infinity) - (perf(a, state.sort) ?? -Infinity);
    }
    if (state.sort === 'risk') {
      return Number(a.risk || 99) - Number(b.risk || 99);
    }
    return String(a[state.sort] || '').localeCompare(String(b[state.sort] || ''));
  });

  return funds;
}

function renderHeader() {
  const generatedAt = byId('generatedAt');
  const coverage = byId('coverage');
  const data = state.data;
  if (!data) return;

  generatedAt.textContent = data.generated_at ? fmt.format(new Date(data.generated_at)) : 'Not yet harvested';
  const summary = data.summary || {};
  coverage.textContent = `${summary.matched_public_rows ?? 0}/${summary.watchlist_count ?? 0} public rows matched`;
}

function renderCards() {
  const cards = byId('cards');
  const funds = filteredFunds();
  const top = funds.slice(0, 8);

  cards.innerHTML = top.map((fund) => `
    <article class="fund-card">
      <span class="badge ${statusClass(fund)}">${statusLabel(fund)}</span>
      <h3>${fund.display_name}</h3>
      <div class="metric"><span>1 year</span><strong>${pct(perf(fund, 'one_year'))}</strong></div>
      <div class="metric"><span>Since launch</span><strong>${pct(perf(fund, 'since_launch'))}</strong></div>
      <div class="metric"><span>To</span><strong>${safeText(fund.performance_to)}</strong></div>
    </article>
  `).join('');
}

function renderRows() {
  const body = byId('fundRows');
  const funds = filteredFunds();

  body.innerHTML = funds.map((fund) => {
    const name = fund.source_url
      ? `<a href="${fund.source_url}" target="_blank" rel="noopener">${fund.display_name}</a>`
      : fund.display_name;
    return `
      <tr title="${fund.note || ''}">
        <td>${name}<br><small>${fund.source_name ? `Matched: ${fund.source_name}` : safeText(fund.note)}</small></td>
        <td><span class="badge ${statusClass(fund)}">${fund.status === 'ok' ? 'OK' : 'Missing'}</span></td>
        <td>${safeText(fund.risk)}</td>
        <td>${safeText(fund.launch_date)}</td>
        <td>${pct(perf(fund, 'one_month'))}</td>
        <td>${pct(perf(fund, 'three_months'))}</td>
        <td>${pct(perf(fund, 'six_months'))}</td>
        <td>${pct(perf(fund, 'one_year'))}</td>
        <td>${pct(perf(fund, 'three_years'))}</td>
        <td>${pct(perf(fund, 'five_years'))}</td>
        <td>${pct(perf(fund, 'ten_years'))}</td>
        <td>${pct(perf(fund, 'since_launch'))}</td>
        <td>${safeText(fund.performance_to)}</td>
      </tr>
    `;
  }).join('');
}

function renderHistory() {
  const el = byId('historyChart');
  const series = state.history?.series || {};
  const funds = (state.data?.funds || []).filter((fund) => fund.status === 'ok');

  const lines = funds
    .map((fund) => {
      const entries = (series[fund.id] || [])
        .map((entry) => ({
          date: entry.performance_to,
          value: entry.performance?.one_year,
          name: fund.display_name,
        }))
        .filter((entry) => entry.date && entry.value !== null && entry.value !== undefined);
      return { fund, entries };
    })
    .filter((item) => item.entries.length >= 2)
    .slice(0, 8);

  if (!lines.length) {
    el.innerHTML = '<p>No history yet. After two or more daily harvests, this panel will draw one-year performance trajectories.</p>';
    return;
  }

  const all = lines.flatMap((item) => item.entries);
  const values = all.map((entry) => Number(entry.value));
  const dates = [...new Set(all.map((entry) => entry.date))].sort();
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(1, (max - min) * 0.12);
  const yMin = min - pad;
  const yMax = max + pad;
  const width = 960;
  const height = 280;
  const left = 44;
  const right = 18;
  const top = 18;
  const bottom = 42;

  const x = (date) => {
    const idx = dates.indexOf(date);
    const denom = Math.max(1, dates.length - 1);
    return left + (idx / denom) * (width - left - right);
  };

  const y = (value) => top + ((yMax - value) / Math.max(1, yMax - yMin)) * (height - top - bottom);

  const paths = lines.map((item, idx) => {
    const points = item.entries.map((entry) => `${x(entry.date)},${y(Number(entry.value))}`);
    return `<polyline points="${points.join(' ')}" fill="none" stroke="currentColor" stroke-width="2" opacity="${0.95 - idx * 0.06}" />`;
  }).join('');

  const labels = lines.map((item, idx) => {
    const last = item.entries[item.entries.length - 1];
    return `<text x="${left}" y="${height - 22 - idx * 14}" font-size="11" fill="currentColor">${item.fund.display_name}: ${pct(last.value)}</text>`;
  }).join('');

  el.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <line x1="${left}" y1="${y(0)}" x2="${width - right}" y2="${y(0)}" stroke="currentColor" opacity="0.15" />
      <line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" stroke="currentColor" opacity="0.2" />
      <line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" stroke="currentColor" opacity="0.2" />
      ${paths}
      <text x="${left}" y="12" font-size="11" fill="currentColor">1Y performance history</text>
      ${labels}
    </svg>
  `;
}

function render() {
  renderHeader();
  renderCards();
  renderRows();
  renderHistory();
}

async function load() {
  const [dataResponse, historyResponse] = await Promise.all([
    fetch(DATA_URL, { cache: 'no-store' }),
    fetch(HISTORY_URL, { cache: 'no-store' }),
  ]);
  if (!dataResponse.ok) throw new Error(`Could not load ${DATA_URL}`);
  state.data = await dataResponse.json();
  state.history = historyResponse.ok ? await historyResponse.json() : { series: {} };
  render();
}

byId('search').addEventListener('input', (event) => {
  state.query = event.target.value;
  render();
});

byId('sort').addEventListener('change', (event) => {
  state.sort = event.target.value;
  render();
});

byId('toggleMissing').addEventListener('click', () => {
  state.showMissing = !state.showMissing;
  byId('toggleMissing').textContent = state.showMissing ? 'Show matched only' : 'Show all';
  render();
});

byId('downloadJson').addEventListener('click', () => {
  window.open(DATA_URL, '_blank', 'noopener');
});

load().catch((error) => {
  console.error(error);
  byId('generatedAt').textContent = 'Load failed';
  byId('coverage').textContent = error.message;
});
