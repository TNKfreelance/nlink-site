(function () {
  "use strict";

  var canvas = document.getElementById("hero-3d");
  var hero = document.getElementById("hero");
  if (!canvas || !hero || !window.THREE) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  } catch (e) {
    return; // no WebGL — the 2D field stays as the hero background
  }

  var W = hero.clientWidth || window.innerWidth;
  var H = hero.clientHeight || window.innerHeight;
  var mobile = window.innerWidth < 760;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W, H, false);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
  camera.position.z = mobile ? 6.4 : 5.6;

  var group = new THREE.Group();
  scene.add(group);

  var CYAN = new THREE.Color("#5dcaff");
  var VIOLET = new THREE.Color("#a78bfa");

  var CLOUD = mobile ? 1100 : 2600;
  var NODES = mobile ? 80 : 150;
  var RADIUS = 1.55;

  function shellPoint(surfaceOnly) {
    var u = Math.random(), v = Math.random();
    var theta = 2 * Math.PI * u;
    var phi = Math.acos(2 * v - 1);
    var noise = 0.16 * Math.sin(phi * 3 + theta * 2) + 0.10 * Math.cos(theta * 3);
    var r = RADIUS + noise + (Math.random() - 0.5) * 0.10;
    if (!surfaceOnly && Math.random() < 0.10) r *= 0.62 + Math.random() * 0.26;
    return [
      Math.sin(phi) * Math.cos(theta) * r,
      Math.cos(phi) * r,
      Math.sin(phi) * Math.sin(theta) * r
    ];
  }

  function tintByHeight(y, target) {
    var t = Math.max(0, Math.min(1, (y + RADIUS) / (RADIUS * 2)));
    target.copy(CYAN).lerp(VIOLET, t);
  }

  // --- point cloud (the body of the brain) ---
  var cloudPos = new Float32Array(CLOUD * 3);
  var cloudCol = new Float32Array(CLOUD * 3);
  var tmp = new THREE.Color();
  for (var i = 0; i < CLOUD; i++) {
    var p = shellPoint(false);
    cloudPos[i * 3] = p[0]; cloudPos[i * 3 + 1] = p[1]; cloudPos[i * 3 + 2] = p[2];
    tintByHeight(p[1], tmp);
    cloudCol[i * 3] = tmp.r; cloudCol[i * 3 + 1] = tmp.g; cloudCol[i * 3 + 2] = tmp.b;
  }
  var cloudGeo = new THREE.BufferGeometry();
  cloudGeo.setAttribute("position", new THREE.BufferAttribute(cloudPos, 3));
  cloudGeo.setAttribute("color", new THREE.BufferAttribute(cloudCol, 3));
  var cloudMat = new THREE.PointsMaterial({
    size: 0.04, sizeAttenuation: true, vertexColors: true,
    transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending
  });
  group.add(new THREE.Points(cloudGeo, cloudMat));

  // --- synapse nodes (brighter, on the surface) ---
  var nodes = [];
  var nodePos = new Float32Array(NODES * 3);
  for (var n = 0; n < NODES; n++) {
    var q = shellPoint(true);
    nodes.push(new THREE.Vector3(q[0], q[1], q[2]));
    nodePos[n * 3] = q[0]; nodePos[n * 3 + 1] = q[1]; nodePos[n * 3 + 2] = q[2];
  }
  var nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute("position", new THREE.BufferAttribute(nodePos, 3));
  var nodeMat = new THREE.PointsMaterial({
    size: 0.07, sizeAttenuation: true, color: new THREE.Color("#bfefff"),
    transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending
  });
  group.add(new THREE.Points(nodeGeo, nodeMat));

  // --- connection lines (nearest-neighbour neural web, built once) ---
  var MAX_SEG = mobile ? 110 : 200;
  var segs = [];
  for (var a = 0; a < nodes.length && segs.length < MAX_SEG; a++) {
    var best = -1, bestD = Infinity;
    for (var b = 0; b < nodes.length; b++) {
      if (a === b) continue;
      var d = nodes[a].distanceToSquared(nodes[b]);
      if (d < bestD) { bestD = d; best = b; }
    }
    if (best > a) segs.push(nodes[a], nodes[best]);
  }
  if (segs.length) {
    var lineGeo = new THREE.BufferGeometry().setFromPoints(segs);
    var lineMat = new THREE.LineBasicMaterial({
      color: CYAN, transparent: true, opacity: 0.16,
      depthWrite: false, blending: THREE.AdditiveBlending
    });
    group.add(new THREE.LineSegments(lineGeo, lineMat));
  }

  // --- luminous core (soft sprite glow, no post-processing) ---
  var glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 128;
  var gctx = glowCanvas.getContext("2d");
  var grad = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(150,230,255,0.9)");
  grad.addColorStop(0.4, "rgba(120,180,255,0.35)");
  grad.addColorStop(1, "rgba(80,120,255,0)");
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 128, 128);
  var glowTex = new THREE.CanvasTexture(glowCanvas);
  var glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, transparent: true, opacity: 0.55,
    depthWrite: false, blending: THREE.AdditiveBlending
  }));
  glow.scale.set(3.0, 3.0, 1);
  group.add(glow);

  // --- interaction + animation ---
  var targetRX = 0, targetRY = 0, curRX = 0, curRY = 0, autoSpin = 0;
  var clock = new THREE.Clock();
  var raf = null, running = false;
  var heroVisible = true, pageVisible = true;

  function onMove(e) {
    var nx = (e.clientX / window.innerWidth) * 2 - 1;
    var ny = (e.clientY / window.innerHeight) * 2 - 1;
    targetRY = nx * 0.4;
    targetRX = ny * 0.25;
  }

  function frame() {
    var t = clock.getElapsedTime();
    autoSpin += 0.0016;
    curRY += (targetRY - curRY) * 0.04;
    curRX += (targetRX - curRX) * 0.04;
    group.rotation.y = autoSpin + curRY;
    group.rotation.x = curRX + Math.sin(t * 0.3) * 0.04;
    var s = 1 + Math.sin(t * 0.8) * 0.015;
    group.scale.set(s, s, s);
    renderer.render(scene, camera);
  }

  function loop() {
    if (!running) return;
    frame();
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running || reduce) return;
    running = true;
    clock.getDelta();
    loop();
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  function sync() {
    if (heroVisible && pageVisible) start();
    else stop();
  }

  function resize() {
    W = hero.clientWidth || window.innerWidth;
    H = hero.clientHeight || window.innerHeight;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H, false);
    if (reduce || !running) frame();
  }

  window.addEventListener("resize", resize);
  if (!mobile) window.addEventListener("mousemove", onMove, { passive: true });
  document.addEventListener("visibilitychange", function () {
    pageVisible = !document.hidden;
    sync();
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      heroVisible = entries[0].isIntersecting;
      sync();
    }, { threshold: 0.02 }).observe(hero);
  }

  // first paint
  frame();
  if (reduce) {
    canvas.classList.add("is-ready");
  } else {
    canvas.classList.add("is-ready");
    start();
  }
})();
