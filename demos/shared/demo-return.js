(function () {
  const path = window.location.pathname.replace(/\/index\.html$/, "/");

  // Do not show the return pill on the demos index itself.
  if (path === "/demos/" || path.endsWith("/demos/")) return;

  // Avoid duplicates if a page already injected it.
  if (document.querySelector("[data-demo-return-pill]")) return;

  const link = document.createElement("a");
  link.className = "demo-return-pill";
  link.setAttribute("data-demo-return-pill", "true");
  link.setAttribute("aria-label", "Back to demos");
  link.href = "/demos/";
  link.textContent = "← Demos";

  document.addEventListener("DOMContentLoaded", function () {
    document.body.appendChild(link);
  });
})();
