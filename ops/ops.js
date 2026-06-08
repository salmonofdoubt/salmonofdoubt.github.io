const $ = (selector) => document.querySelector(selector);

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const niceDate = (value) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

async function loadJson(path, fallback) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) return fallback;
  return response.json();
}

function fileLinks(files) {
  if (!Array.isArray(files) || !files.length) return "None configured";
  return files.map((file) => {
    const label = file.exists ? file.path : `${file.path} (missing)`;
    return `<div><a href="../${escapeHtml(file.path)}">${escapeHtml(label)}</a></div>`;
  }).join("");
}

function renderJobs(status) {
  const table = $("[data-job-table]");
  const generated = $("[data-generated-at]");

  if (generated) generated.textContent = `Generated: ${niceDate(status.generated_at)}`;

  const jobs = Array.isArray(status.jobs) ? status.jobs : [];
  if (!jobs.length) {
    table.innerHTML = `<tr><td colspan="6">No job status rows available yet.</td></tr>`;
    return;
  }

  table.innerHTML = jobs.map((job) => `
    <tr>
      <td>
        <strong>${escapeHtml(job.name)}</strong>
        <div>${escapeHtml(job.message || "")}</div>
      </td>
      <td>${escapeHtml(job.frequency)}</td>
      <td><span class="pill" data-state="${escapeHtml(job.status)}">${escapeHtml(job.status)}</span></td>
      <td>${escapeHtml(niceDate(job.last_success_at))}</td>
      <td>${job.data_age_hours === null || job.data_age_hours === undefined ? "Unknown" : `${escapeHtml(job.data_age_hours)} h`}</td>
      <td>${fileLinks(job.files)}</td>
    </tr>
  `).join("");
}

function renderRegistry(registry) {
  const target = $("[data-registry]");
  const monitors = Array.isArray(registry.monitors) ? registry.monitors : [];

  if (!monitors.length) {
    target.innerHTML = `<p>No registry entries found.</p>`;
    return;
  }

  target.innerHTML = monitors.map((monitor) => `
    <article class="registry-card">
      <h3>${escapeHtml(monitor.name)}</h3>
      <p>${escapeHtml(monitor.summary)}</p>
      <div class="registry-card__meta">
        <span class="pill">${escapeHtml(monitor.category)}</span>
        <span class="pill">${escapeHtml(monitor.maturity)}</span>
        <span class="pill">${escapeHtml(monitor.frequency)}</span>
        <span class="pill">${monitor.public ? "public" : "private"}</span>
      </div>
      ${monitor.landing_page ? `<p><a href="../${escapeHtml(monitor.landing_page)}">Open monitor page</a></p>` : ""}
      ${monitor.caveat ? `<p><strong>Caveat:</strong> ${escapeHtml(monitor.caveat)}</p>` : ""}
    </article>
  `).join("");
}

async function init() {
  const [registry, status] = await Promise.all([
    loadJson("../data/monitor-registry.json", { monitors: [] }),
    loadJson("../data/job-status.json", { jobs: [] })
  ]);

  renderJobs(status);
  renderRegistry(registry);
}

init().catch((error) => {
  console.error(error);
  const table = $("[data-job-table]");
  if (table) table.innerHTML = `<tr><td colspan="6">Ops data could not be loaded.</td></tr>`;
});
