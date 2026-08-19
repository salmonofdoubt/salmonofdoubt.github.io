(function () {
  const githubSponsorUrl = "https://github.com/sponsors/salmonofdoubt";
  const coffeeUrl = "https://buymeacoffee.com/andrecbaum1";

  // Show on both the demos index and individual demo pages.
  // Demo-specific content belongs in each demo, not in this shared control.
  document.addEventListener("DOMContentLoaded", function () {
    if (document.querySelector("[data-demo-support-widget]")) return;

    const widget = document.createElement("div");
    widget.className = "demo-support-widget";
    widget.setAttribute("data-demo-support-widget", "true");

    const button = document.createElement("button");
    button.className = "demo-support-pill";
    button.type = "button";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "demo-support-menu");
    button.textContent = "Support this work";

    const menu = document.createElement("div");
    menu.className = "demo-support-menu";
    menu.id = "demo-support-menu";

    const github = document.createElement("a");
    github.className = "demo-support-option";
    github.href = githubSponsorUrl;
    github.target = "_blank";
    github.rel = "noopener";
    github.innerHTML = "<strong>GitHub Sponsors</strong><span>Best for open-source and civic-tech support.</span>";

    const coffee = document.createElement("a");
    coffee.className = "demo-support-option coffee";
    coffee.href = coffeeUrl;
    coffee.target = "_blank";
    coffee.rel = "noopener";
    coffee.innerHTML = "<strong>Buy Me a Coffee</strong><span>Quick support for friends and casual visitors.</span>";

    menu.append(github, coffee);
    widget.append(menu, button);
    document.body.appendChild(widget);

    function closeWidget() {
      widget.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
    }

    function openWidget() {
      widget.classList.add("is-open");
      button.setAttribute("aria-expanded", "true");
    }

    button.addEventListener("click", function (event) {
      event.stopPropagation();
      if (widget.classList.contains("is-open")) closeWidget();
      else openWidget();
    });

    document.addEventListener("click", function (event) {
      if (!widget.contains(event.target)) closeWidget();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeWidget();
        button.blur();
      }
    });
  });
})();
