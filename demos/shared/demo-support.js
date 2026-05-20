(function () {
  const sponsorUrl = "https://github.com/sponsors/salmonofdoubt";
  const path = window.location.pathname.replace(/\/index\.html$/, "/");

  // Do not show on the demos index itself; individual demos get the support control.
  if (path === "/demos/" || path.endsWith("/demos/")) return;

  if (document.querySelector("[data-demo-support-pill]")) return;

  const link = document.createElement("a");
  link.className = "demo-support-pill";
  link.setAttribute("data-demo-support-pill", "true");
  link.href = sponsorUrl;
  link.target = "_blank";
  link.rel = "noopener";
  link.setAttribute("aria-label", "Sponsor this work on GitHub Sponsors");
  link.textContent = "Sponsor this work";

  document.addEventListener("DOMContentLoaded", function () {
    document.body.appendChild(link);
  });
})();
