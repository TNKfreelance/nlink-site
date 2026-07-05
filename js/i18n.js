(function () {
  "use strict";

  var STORAGE_KEY = "nlink-lang";
  var body = document.body;

  function apply(lang) {
    body.setAttribute("data-lang", lang);
    document.documentElement.setAttribute("lang", lang);

    var nodes = document.querySelectorAll("[data-ja], [data-en]");
    nodes.forEach(function (el) {
      var val = el.getAttribute("data-" + lang);
      if (val !== null) el.textContent = val;
    });

    var inputs = document.querySelectorAll("[data-ja-placeholder], [data-en-placeholder]");
    inputs.forEach(function (el) {
      var ph = el.getAttribute("data-" + lang + "-placeholder");
      if (ph !== null) el.setAttribute("placeholder", ph);
    });

    document.querySelectorAll("[data-lang-opt]").forEach(function (opt) {
      opt.classList.toggle("is-active", opt.getAttribute("data-lang-opt") === lang);
    });

    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }

  function current() {
    var saved;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (saved === "ja" || saved === "en") return saved;
    var nav = (navigator.language || "ja").toLowerCase();
    return nav.indexOf("ja") === 0 ? "ja" : "en";
  }

  var toggle = document.getElementById("lang-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = body.getAttribute("data-lang") === "ja" ? "en" : "ja";
      apply(next);
    });
  }

  apply(current());
})();
