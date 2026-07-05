(function () {
  "use strict";

  var canvas = document.getElementById("quantum-field");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
  var particles = [];
  var mouse = { x: -9999, y: -9999, active: false };
  var LINK_DIST = 130;
  var MOUSE_DIST = 180;

  function particleCount() {
    var area = window.innerWidth * window.innerHeight;
    var n = Math.round(area / 14000);
    return Math.max(28, Math.min(n, 120));
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function makeParticles() {
    var count = particleCount();
    particles = [];
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: rand(-0.25, 0.25),
        vy: rand(-0.25, 0.25),
        r: rand(0.8, 2.2),
        hue: Math.random() < 0.5 ? "cyan" : "violet"
      });
    }
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    makeParticles();
  }

  function color(hue, alpha) {
    return hue === "cyan"
      ? "rgba(125, 220, 255, " + alpha + ")"
      : "rgba(167, 139, 250, " + alpha + ")";
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];

      for (var j = i + 1; j < particles.length; j++) {
        var q = particles[j];
        var dx = p.x - q.x, dy = p.y - q.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINK_DIST) {
          var a = (1 - dist / LINK_DIST) * 0.18;
          ctx.strokeStyle = color(p.hue, a);
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }

      if (mouse.active) {
        var mdx = p.x - mouse.x, mdy = p.y - mouse.y;
        var mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < MOUSE_DIST) {
          var ma = (1 - mdist / MOUSE_DIST) * 0.5;
          ctx.strokeStyle = color("cyan", ma);
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
          p.x += (mdx / mdist) * (1 - mdist / MOUSE_DIST) * 0.6;
          p.y += (mdy / mdist) * (1 - mdist / MOUSE_DIST) * 0.6;
        }
      }

      ctx.fillStyle = color(p.hue, 0.85);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  var fieldRunning = false;

  function step() {
    if (!fieldRunning) return;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    }
    draw();
    requestAnimationFrame(step);
  }

  function startField() {
    if (fieldRunning || reduceMotion) return;
    fieldRunning = true;
    step();
  }

  function stopField() {
    fieldRunning = false;
  }

  window.addEventListener("resize", resize);
  window.addEventListener("mousemove", function (e) {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
  });
  window.addEventListener("mouseout", function () { mouse.active = false; });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stopField();
    else startField();
  });

  resize();

  if (reduceMotion) {
    draw();
  } else {
    startField();
  }

  var nav = document.getElementById("nav");
  if (nav) {
    window.addEventListener("scroll", function () {
      nav.classList.toggle("is-stuck", window.scrollY > 40);
    }, { passive: true });
  }

  var reveals = document.querySelectorAll(".reveal");

  function showInView() {
    for (var i = 0; i < reveals.length; i++) {
      var el = reveals[i];
      if (el.classList.contains("is-visible")) continue;
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.92 && r.bottom > 0) {
        el.classList.add("is-visible");
      }
    }
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  // Fail-safe: never leave content stuck hidden if IntersectionObserver
  // does not fire (older engines, restored tabs, automation contexts).
  window.addEventListener("scroll", showInView, { passive: true });
  window.addEventListener("resize", showInView);
  window.addEventListener("load", showInView);
  showInView();
  setTimeout(showInView, 1000);

  var form = document.getElementById("waitlist-form");
  var note = document.getElementById("waitlist-note");
  if (form && note) {
    form.addEventListener("submit", function (e) {
      var action = form.getAttribute("action");
      if (!action || action === "#") {
        e.preventDefault();
        var email = form.querySelector("input[type=email]");
        var lang = document.body.getAttribute("data-lang");
        if (!email || !email.value || email.validity.typeMismatch || !email.checkValidity()) {
          note.textContent = lang === "ja"
            ? "有効なメールアドレスを入力してください。"
            : "Enter a valid email address.";
          note.className = "waitlist__note is-error";
          return;
        }
        note.textContent = lang === "ja"
          ? "フォーム送信先は接続準備中です。Formspree のIDを設定すると有効になります。"
          : "The form endpoint is not connected yet. Set your Formspree ID to enable it.";
        note.className = "waitlist__note is-success";
      }
    });
  }
})();
