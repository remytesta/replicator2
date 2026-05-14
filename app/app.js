const CONFIG = {
  API_URL: "",
};

const appState = {
  route: "home",
  currentVaseId: "maquette",
  activeScenarioId: null,
  slideIndex: 0,
  slideDirection: 1,
  commandState: "idle",
  sheetOpen: false,
};

const rawVases = window.REPLICATOR_VASES || [];
const vases = rawVases.map((vase, index) => normalizeVase(vase, index));
const vasesById = new Map(vases.map((vase) => [vase.id, vase]));
const consoleOrder = window.REPLICATOR_CONSOLE_ORDER || vases.map((vase) => vase.id);
const choreographies = window.REPLICATOR_CHOREOGRAPHIES || [];
const HOTSPOT_REFERENCE = { width: 1800, height: 1000 };
const GCODE_HISTORY_KEY = "replicator2:gcode-history";
const triggeredVaseHooks = new Set();
let gcodeHistory = loadGcodeHistory();

const screens = {
  home: document.getElementById("homeScreen"),
  console: document.getElementById("consoleScreen"),
  vase: document.getElementById("vaseScreen"),
};

const toastEl = document.getElementById("toast");
const coordDebugEl = document.getElementById("coordDebug");
let toastTimer;

function cleanText(value, fallback = "") {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function loadGcodeHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(GCODE_HISTORY_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function describeHook(hook) {
  if (!hook) return "Aucun G-code";
  if (hook.name) return hook.name;
  if (hook.endpoint) return hook.endpoint;
  if (hook.command) return hook.command;
  if (Array.isArray(hook.commands)) return `${hook.commands.length} commandes G-code`;
  return "Hook G-code incomplet";
}

function recordGcodeHistory(entry) {
  gcodeHistory = [
    {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      ...entry,
    },
    ...gcodeHistory,
  ].slice(0, 50);

  try {
    localStorage.setItem(GCODE_HISTORY_KEY, JSON.stringify(gcodeHistory));
  } catch {}

  renderGcodeHistory();
}

function normalizeVase(vase, index) {
  const title = cleanText(vase.title, `Scenario ${index + 1}`);
  const label = cleanText(vase.mapLabel, title.replace(/^Vase\s+/i, ""));
  const slides = Array.isArray(vase.slides) && vase.slides.length
    ? vase.slides
    : [{ title: "Vue generale", caption: cleanText(vase.shortDescription, "Scenario a renseigner.") }];

  return {
    ...vase,
    id: cleanText(vase.id, `scenario-${index + 1}`),
    order: cleanText(vase.order, String(index + 1).padStart(2, "0")),
    title,
    mapLabel: label,
    chapter: cleanText(vase.chapter, title),
    shortDescription: cleanText(vase.shortDescription, ""),
    physicalState: cleanText(vase.physicalState, ""),
    detailAction: cleanText(vase.detailAction, ""),
    hardware: cleanText(vase.hardware, ""),
    hotspot: vase.hotspot || { x: 50, y: 50, w: 18, h: 18 },
    sketchImage: cleanText(vase.sketchImage, ""),
    slides: slides.map((slide, slideIndex) => ({
      ...slide,
      title: cleanText(slide.title, `Vue ${slideIndex + 1}`),
      caption: cleanText(slide.caption, ""),
      type: cleanText(slide.type, slide.video ? "video" : "image"),
      sceneGcodeHook: slide.sceneGcodeHook || null,
    })),
  };
}

async function api(endpoint, method = "POST", body = null) {
  try {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (body) opts.body = JSON.stringify(body);
    const response = await fetch(CONFIG.API_URL + endpoint, opts);
    const raw = await response.text();
    let data = {};
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(response.ok ? "Reponse API illisible" : "API indisponible ou OctoPrint non connecte");
      }
    }
    if (!response.ok || data.status === "error") {
      throw new Error(data.message || "Erreur API");
    }
    return data;
  } catch (error) {
    throw new Error(error.message || "API indisponible ou OctoPrint non connecte");
  }
}

function showToast(title, type = "info", detail = "") {
  if (!toastEl) return;
  const item = document.createElement("div");
  item.className = `toast-message is-${type}`;
  item.innerHTML = `
    <strong>${title}</strong>
    ${detail ? `<span>${detail}</span>` : ""}
  `;
  toastEl.prepend(item);
  requestAnimationFrame(() => item.classList.add("is-visible"));
  setTimeout(() => {
    item.classList.remove("is-visible");
    setTimeout(() => item.remove(), 300);
  }, 3600);
}

function routeTo(route, options = {}) {
  const nextRoute = screens[route] ? route : "home";
  const leavingVaseScreen = appState.route === "vase" && nextRoute !== "vase";

  if (leavingVaseScreen || options.vaseId) {
    pauseActiveVideos();
  }

  if (options.vaseId) {
    appState.currentVaseId = options.vaseId;
    appState.activeScenarioId = options.vaseId;
    appState.slideIndex = 0;
    updateSketchState();
    renderVaseDetail();
  }

  Object.values(screens).forEach((screen) => screen.classList.remove("is-active"));
  screens[nextRoute].classList.add("is-active");
  appState.route = nextRoute;

  if (nextRoute !== "vase") stopVaseMedia();
  if (nextRoute === "vase") renderVaseDetail();
  if (nextRoute === "home") {
    updateSketchState();
    renderScenarioSheet();
  }

  if (!options.silentHash) {
    const hash = nextRoute === "vase" ? `#vase:${appState.currentVaseId}` : `#${nextRoute}`;
    if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
  }
}

function buildSketch() {
  const hotspots = document.getElementById("sketchHotspots");

  hotspots.innerHTML = vases.map((vase) => `
    <button
      class="sketch-hotspot"
      style="${hotspotStyle(vase.hotspot, Number(vase.order) - 1)}"
      data-vase-id="${vase.id}"
      type="button"
      aria-label="${vase.title}"
    >
      <span class="pickup-core"></span>
      <span class="pickup-label">${vase.mapLabel}</span>
    </button>
  `).join("") + `
    <button
      class="sketch-hotspot sketch-hotspot-console"
      style="${hotspotStyle({ pxX: 1210, pxY: 700 }, vases.length)}"
      type="button"
      id="consoleBtn"
      aria-label="Ouvrir la console machine"
    >
      <span class="pickup-core"></span>
      <span class="pickup-label">Console</span>
    </button>
  `;

  hotspots.querySelectorAll(".sketch-hotspot[data-vase-id]").forEach((button) => {
    button.addEventListener("focus", () => previewScenario(button.dataset.vaseId, false));
    button.addEventListener("click", () => handleSketchPick(button.dataset.vaseId));
  });

  document.getElementById("consoleBtn").addEventListener("click", () => routeTo("console"));
}

function hotspotStyle(hotspot, index = 0) {
  const x = hotspot.pxX !== undefined ? (hotspot.pxX / HOTSPOT_REFERENCE.width) * 100 : hotspot.x;
  const y = hotspot.pxY !== undefined ? (hotspot.pxY / HOTSPOT_REFERENCE.height) * 100 : hotspot.y;
  return `--x:${x}%; --y:${y}%;`;
}

function previewScenario(vaseId, openSheet = true) {
  appState.activeScenarioId = vaseId;
  appState.currentVaseId = vaseId;
  appState.sheetOpen = openSheet;
  updateSketchState();
  renderScenarioSheet();
}

async function handleSketchPick(vaseId) {
  if (!triggeredVaseHooks.has(vaseId)) {
    const vase = vasesById.get(vaseId);
    if (vase?.gcodeHook) {
      runHook(vase.gcodeHook, `Activation: ${vase.mapLabel}`)
        .then(() => triggeredVaseHooks.add(vaseId))
        .catch((error) => {
          setConsoleStatus(error.message, "error");
        });
    }
  }

  if (appState.sheetOpen && appState.activeScenarioId === vaseId) {
    routeTo("vase", { vaseId });
    return;
  }
  previewScenario(vaseId, true);
}

function updateSketchState() {
  document.querySelectorAll("[data-vase-id]").forEach((el) => {
    const isActive = el.dataset.vaseId === appState.activeScenarioId;
    el.classList.toggle("is-active", isActive);
  });
}

function renderScenarioSheet() {
  const sheet = document.getElementById("scenarioSheet");
  const vase = vasesById.get(appState.activeScenarioId) || vases[0];
  if (!sheet || !vase) return;

  sheet.classList.toggle("is-visible", appState.sheetOpen && appState.route === "home");
  document.getElementById("sketchStage")?.classList.toggle("has-sheet", appState.sheetOpen && appState.route === "home");
  sheet.innerHTML = `
    <div class="scenario-header">
      <h2>${vase.mapLabel}</h2>
      <button class="icon-action scenario-close" type="button" aria-label="Fermer">
        <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <p class="scenario-motion">${vase.shortDescription}</p>
    <div class="scenario-actions">
      <button class="icon-action scenario-open" type="button" data-vase-id="${vase.id}" aria-label="Ouvrir">
        <span>Lancer la Choregraphie</span>
        <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </button>
    </div>
  `;
  sheet.querySelector(".scenario-close").addEventListener("click", () => {
    appState.sheetOpen = false;
    renderScenarioSheet();
  });
  sheet.querySelector(".scenario-open").addEventListener("click", () => routeTo("vase", { vaseId: vase.id }));
}

function buildConsole() {
  const grid = document.getElementById("consoleVaseGrid");
  grid.innerHTML = `
    <div class="console-history-head">
      <span>Historique G-code</span>
      <small>${gcodeHistory.length} entrees</small>
    </div>
    <div class="console-history" id="consoleHistory"></div>
  `;
  renderGcodeHistory();

  const choreoPanel = document.getElementById("choreoPanel");
  const visibleChoreographies = choreographies.slice(0, 4);
  choreoPanel.innerHTML = `
    ${visibleChoreographies.map((choreo, index) => `
    <button class="choreo-command" data-choreo-id="${choreo.id}" type="button">
      <span>Choregraphie ${index + 1}</span>
    </button>
  `).join("")}
  `;

  choreoPanel.querySelectorAll(".choreo-command").forEach((button) => {
    button.addEventListener("click", () => runChoreo(button.dataset.choreoId, button));
  });
}

function pauseActiveVideos() {
  document.querySelectorAll("video").forEach((video) => {
    video.pause();
  });
}

function stopVaseMedia() {
  pauseActiveVideos();
  const media = document.getElementById("vaseMedia");
  if (media) media.innerHTML = "";
}

function renderGcodeHistory() {
  const historyEl = document.getElementById("consoleHistory");
  if (!historyEl) return;

  if (!gcodeHistory.length) {
    historyEl.innerHTML = `
      <div class="history-empty">
        <strong>Aucun G-code lance</strong>
        <span>Les activations depuis la Chapelle, les scenes et les choregraphies apparaitront ici.</span>
      </div>
    `;
    return;
  }

  historyEl.innerHTML = gcodeHistory.map((entry) => `
    <article class="history-item" data-state="${entry.state}">
      <time>${entry.time}</time>
      <div>
        <strong>${entry.label}</strong>
        <code>${entry.gcode}</code>
        ${entry.message ? `<span>${entry.message}</span>` : ""}
      </div>
    </article>
  `).join("");
}

function setConsoleStatus(message, state = "idle") {
  const el = document.getElementById("consoleStatus");
  el.textContent = message;
  el.dataset.state = state;
}

async function runVaseHook(vaseId, button) {
  const vase = vasesById.get(vaseId);
  if (!vase) return;

  appState.activeScenarioId = vaseId;
  appState.currentVaseId = vaseId;
  updateSketchState();

  if (!vase.gcodeHook) {
    setConsoleStatus(`${vase.title}: pret`, "done");
    showToast(vase.physicalState, "success", vase.mapLabel);
    routeTo("vase", { vaseId });
    return;
  }

  await runCommand(button, async () => {
    setConsoleStatus(`Envoi: ${vase.title}`, "sending");
    return runHook(vase.gcodeHook, `Activation: ${vase.mapLabel}`);
  }, `Ok: ${vase.title}`);
}

async function runChoreo(id, button) {
  const choreo = choreographies.find((item) => item.id === id);
  await runCommand(button, async () => {
    setConsoleStatus(`Envoi: ${choreo?.label || id}`, "sending");
    return runHook(choreo?.gcodeHook || { endpoint: `/api/choreo/run/${id}` }, `Console: ${choreo?.label || id}`);
  }, `Ok: ${choreo?.label || id}`);
}

async function runHook(hook, statusLabel = "G-code") {
  if (!hook) return { status: "skipped" };
  setConsoleStatus(statusLabel, "sending");
  const gcode = describeHook(hook);
  const debugLabel = hook.name || gcode;

  try {
    let result;
    if (hook.endpoint) {
      result = await api(hook.endpoint, hook.method || "POST", hook.body || null);
    } else if (hook.command) {
      result = await api("/api/gcode", "POST", { command: hook.command });
    } else if (Array.isArray(hook.commands)) {
      for (const command of hook.commands) {
        await api("/api/gcode", "POST", { command });
      }
      result = { status: "ok" };
    } else {
      throw new Error("Hook G-code incomplet");
    }

    recordGcodeHistory({
      label: debugLabel,
      gcode,
      state: "done",
      message: result?.message || "Envoye",
    });
    showToast(debugLabel, "success", "G-code lance");
    return result;
  } catch (error) {
    recordGcodeHistory({
      label: debugLabel,
      gcode,
      state: "error",
      message: error.message,
    });
    showToast(debugLabel, "error", error.message);
    throw error;
  }
}

async function runCommand(button, task, successMessage) {
  if (appState.commandState === "sending") return;
  appState.commandState = "sending";

  try {
    await task();
    setConsoleStatus(successMessage, "done");
  } catch (error) {
    setConsoleStatus(error.message, "error");
  } finally {
    appState.commandState = "idle";
  }
}

function renderVaseDetail() {
  const vase = vasesById.get(appState.currentVaseId) || vases[0];
  if (!vase) return;
  const slide = vase.slides[appState.slideIndex] || vase.slides[0];

  document.getElementById("vaseTitle").textContent = vase.title;
  document.getElementById("vaseCount").textContent = vase.mapLabel;

  const thumb = document.getElementById("vaseSketchThumb");
  thumb.src = vase.sketchImage || "";
  thumb.hidden = !vase.sketchImage;

  const copyThumb = document.getElementById("vaseCopyThumb");
  copyThumb.src = vase.sketchImage || "";
  copyThumb.hidden = !vase.sketchImage;

  document.getElementById("slideLabel").textContent = slide.title;
  document.getElementById("slideCaption").textContent = slide.caption || vase.shortDescription;
  document.getElementById("vaseDescription").textContent = vase.detailAction;

  const media = document.getElementById("vaseMedia");
  media.dataset.direction = String(appState.slideDirection);

  // Force reflow to restart animations
  pauseActiveVideos();
  media.innerHTML = "";
  void media.offsetWidth;
  media.innerHTML = renderSlideMedia(vase, slide);

  const video = media.querySelector("video");
  if (video) bindVideoControls(media, video);

  renderSlideDots(vase);
}

function renderSlideMedia(vase, slide) {
  if (slide.video) {
    return `
      <div class="video-shell">
        <video class="vase-video" src="${slide.video}" playsinline preload="metadata" autoplay muted loop></video>
        <div class="video-loader" aria-hidden="true"></div>
        <div class="video-controls" aria-label="Controles video">
          <button class="video-btn video-toggle-play" type="button" aria-label="Mettre la video en pause"></button>
          <button class="video-btn video-toggle-sound" type="button" aria-label="Activer le son"></button>
        </div>
      </div>
    `;
  }
  if (slide.image) {
    return `<img class="vase-image" src="${slide.image}" alt="${vase.title}">`;
  }
  if (slide.poem) {
    return `<div class="poem-panel"><span>${vase.title}</span><p>${slide.poem}</p></div>`;
  }
  return `<div class="vase-placeholder"><span>${vase.chapter}</span><strong>${slide.title}</strong></div>`;
}

function bindVideoControls(media, video) {
  const playBtn = media.querySelector(".video-toggle-play");
  const soundBtn = media.querySelector(".video-toggle-sound");
  const shell = media.querySelector(".video-shell");

  video.volume = 0.85;

  const syncControls = () => {
    if (playBtn) {
      playBtn.innerHTML = video.paused
        ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`
        : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>`;
      playBtn.setAttribute("aria-label", video.paused ? "Lire la video" : "Mettre la video en pause");
    }
    if (soundBtn) {
      soundBtn.innerHTML = video.muted
        ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4zM18 9l4 4M22 9l-4 4"/></svg>`
        : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4zM17 9c1 1 1 5 0 6M20 7c2.5 2.5 2.5 7.5 0 10"/></svg>`;
      soundBtn.classList.toggle("is-on", !video.muted);
      soundBtn.setAttribute("aria-label", video.muted ? "Activer le son" : "Couper le son");
    }
  };

  const syncLoading = () => {
    shell?.classList.toggle("is-loading", video.readyState < 3);
  };

  playBtn?.addEventListener("click", async () => {
    if (video.paused) {
      await video.play().catch(() => {});
    } else {
      video.pause();
    }
    syncControls();
  });

  soundBtn?.addEventListener("click", async () => {
    video.muted = !video.muted;
    if (!video.muted && video.paused) {
      await video.play().catch(() => {});
    }
    syncControls();
  });

  video.addEventListener("play", syncControls);
  video.addEventListener("pause", syncControls);
  video.addEventListener("volumechange", syncControls);
  video.addEventListener("loadstart", syncLoading);
  video.addEventListener("waiting", syncLoading);
  video.addEventListener("canplay", syncLoading);
  video.addEventListener("playing", syncLoading);
  syncControls();
  syncLoading();
}

function renderSlideDots(vase) {
  const dots = document.getElementById("slideDots");
  dots.innerHTML = vase.slides.map((slide, index) => `
    <span class="slide-dot ${index === appState.slideIndex ? "is-active" : ""}" aria-current="${index === appState.slideIndex ? "step" : "false"}">SCENE ${index + 1}</span>
  `).join("");
}

function renderVaseNav(activeId) {
  const nav = document.getElementById("vaseNav");
  nav.innerHTML = vases.map((vase) => `
    <button class="vase-chip ${vase.id === activeId ? "is-active" : ""}" data-vase-id="${vase.id}" type="button">
      ${vase.mapLabel}
    </button>
  `).join("");
  nav.querySelectorAll(".vase-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      appState.currentVaseId = chip.dataset.vaseId;
      appState.activeScenarioId = chip.dataset.vaseId;
      appState.slideIndex = 0;
      appState.slideDirection = 1;
      updateSketchState();
      renderVaseDetail();
    });
  });
}

function moveSlide(direction, options = {}) {
  const vase = vasesById.get(appState.currentVaseId);
  if (!vase) return;
  appState.slideDirection = direction;
  appState.slideIndex = (appState.slideIndex + direction + vase.slides.length) % vase.slides.length;
  renderVaseDetail();

  const slide = vase.slides[appState.slideIndex];
  if (options.triggerScene && slide?.sceneGcodeHook) {
    runHook(slide.sceneGcodeHook, `${vase.mapLabel}: scene ${appState.slideIndex + 1}`).catch((error) => {
      setConsoleStatus(error.message, "error");
    });
  }
}

function bindEvents() {
  document.getElementById("nextSlideBtn").addEventListener("click", () => moveSlide(1, { triggerScene: true }));

  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => routeTo(button.dataset.route));
  });

  window.addEventListener("keydown", (event) => {
    if (appState.route !== "vase") return;
    if (event.key === "ArrowRight") moveSlide(1, { triggerScene: true });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseActiveVideos();
  });

  window.addEventListener("hashchange", () => {
    if (!window.location.hash.startsWith("#vase:")) stopVaseMedia();
  });
}

function isDebugMode() {
  return window.location.search.includes("debug") || window.location.hash === "#debug";
}

function formatSketchCoords(event) {
  const art = document.querySelector(".sketch-container");
  if (!art) return null;
  const rect = art.getBoundingClientRect();
  const x = Math.round(((event.clientX - rect.left) / rect.width) * HOTSPOT_REFERENCE.width);
  const y = Math.round(((event.clientY - rect.top) / rect.height) * HOTSPOT_REFERENCE.height);
  return { x, y };
}

function enableCoordinateDebug() {
  if (!coordDebugEl || !isDebugMode()) return;
  const art = document.querySelector(".sketch-container");
  if (!art) return;

  coordDebugEl.classList.add("is-visible");
  coordDebugEl.textContent = "x -- y --";
  art.classList.add("is-debugging");

  const update = (event, pinned = false) => {
    const coords = formatSketchCoords(event);
    if (!coords) return;
    coordDebugEl.textContent = `x ${coords.x} y ${coords.y}${pinned ? "  (copied)" : ""}`;
  };

  art.addEventListener("pointermove", (event) => update(event));
  art.addEventListener("click", (event) => {
    update(event, true);
    event.preventDefault();
    event.stopPropagation();
  }, true);
}

function applyInitialHash() {
  const hash = window.location.hash.replace("#", "");
  if (!hash || hash === "home") return;
  if (hash.startsWith("vase:")) {
    const vaseId = hash.split(":")[1];
    if (vasesById.has(vaseId)) routeTo("vase", { vaseId, silentHash: true });
    return;
  }
  if (screens[hash]) routeTo(hash, { silentHash: true });
}

function init() {
  buildSketch();
  buildConsole();
  updateSketchState();
  renderScenarioSheet();
  renderVaseDetail();
  bindEvents();
  applyInitialHash();
  enableCoordinateDebug();
}

init();
