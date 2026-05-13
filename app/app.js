const CONFIG = {
  API_URL: "",
};

const appState = {
  route: "home",
  currentVaseId: "maquette",
  activeScenarioId: "maquette",
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
    })),
  };
}

async function api(endpoint, method = "POST", body = null) {
  try {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (body) opts.body = JSON.stringify(body);
    const response = await fetch(CONFIG.API_URL + endpoint, opts);
    const data = await response.json();
    if (!response.ok || data.status === "error") {
      throw new Error(data.message || "Erreur API");
    }
    return data;
  } catch (error) {
    throw new Error(error.message || "Erreur reseau");
  }
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 2500);
}

function routeTo(route, options = {}) {
  const nextRoute = screens[route] ? route : "home";

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
      style="${hotspotStyle({ pxX: 1210, pxY: 630 }, vases.length)}"
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

function handleSketchPick(vaseId) {
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
  sheet.innerHTML = `
    ${vase.sketchImage ? `<img class="scenario-thumb" src="${vase.sketchImage}" alt="">` : ""}
    <div class="scenario-copy">
      <p class="scenario-order">${vase.order} / ${vases.length}</p>
      <h2>${vase.title}</h2>
      <p class="scenario-motion">${vase.shortDescription}</p>
    </div>
    <div class="scenario-actions">
      <button class="icon-action scenario-close" type="button" aria-label="Fermer">
        <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      <button class="icon-action scenario-open" type="button" data-vase-id="${vase.id}" aria-label="Ouvrir">
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
  grid.innerHTML = consoleOrder.map((id) => {
    const vase = vasesById.get(id);
    if (!vase) return "";
    return `
      <button class="console-vase" data-vase-id="${vase.id}" type="button">
        ${vase.sketchImage ? `<img class="console-vase-thumb" src="${vase.sketchImage}" alt="">` : ""}
        <span>${vase.order}</span>
        <span class="console-vase-copy">
          <strong>${vase.mapLabel}</strong>
          <small>${vase.hardware}</small>
          <em>${vase.physicalState}</em>
        </span>
      </button>
    `;
  }).join("");

  grid.querySelectorAll(".console-vase").forEach((button) => {
    button.addEventListener("click", () => runVaseHook(button.dataset.vaseId, button));
  });

  const choreoPanel = document.getElementById("choreoPanel");
  choreoPanel.innerHTML = choreographies.map((choreo, index) => `
    <button class="choreo-command" data-choreo-id="${choreo.id}" type="button">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <span class="console-vase-copy">
        <strong>${choreo.label}</strong>
        <small>${choreo.description}</small>
      </span>
    </button>
  `).join("");

  choreoPanel.querySelectorAll(".choreo-command").forEach((button) => {
    button.addEventListener("click", () => runChoreo(button.dataset.choreoId, button));
  });
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
    showToast(vase.physicalState);
    routeTo("vase", { vaseId });
    return;
  }

  await runCommand(button, async () => {
    setConsoleStatus(`Envoi: ${vase.title}`, "sending");
    if (vase.gcodeHook.endpoint) {
      return api(vase.gcodeHook.endpoint, vase.gcodeHook.method || "POST", vase.gcodeHook.body || null);
    }
    if (vase.gcodeHook.command) {
      return api("/api/gcode", "POST", { command: vase.gcodeHook.command });
    }
    throw new Error("Hook incomplet");
  }, `Ok: ${vase.title}`);
}

async function runChoreo(id, button) {
  const choreo = choreographies.find((item) => item.id === id);
  await runCommand(button, async () => {
    setConsoleStatus(`Simulation: ${choreo?.label || id}`, "sending");
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { status: "ok" };
  }, `Ok: ${choreo?.label || id}`);
}

async function runCommand(button, task, successMessage) {
  if (appState.commandState === "sending") return;
  appState.commandState = "sending";

  try {
    await task();
    setConsoleStatus(successMessage, "done");
    showToast(successMessage);
  } catch (error) {
    setConsoleStatus(error.message, "error");
    showToast(error.message);
  } finally {
    appState.commandState = "idle";
  }
}

function renderVaseDetail() {
  const vase = vasesById.get(appState.currentVaseId) || vases[0];
  if (!vase) return;
  const slide = vase.slides[appState.slideIndex] || vase.slides[0];

  document.getElementById("vaseTitle").textContent = vase.title;
  document.getElementById("vaseCount").textContent = `${vase.order} / ${vases.length}`;

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
  media.innerHTML = "";
  void media.offsetWidth;
  media.innerHTML = renderSlideMedia(vase, slide);

  const video = media.querySelector("video");
  if (video) bindVideoControls(media, video);

  renderSlideDots(vase);
  renderVaseNav(vase.id);
}

function renderSlideMedia(vase, slide) {
  if (slide.video) {
    return `
      <div class="video-shell">
        <video class="vase-video" src="${slide.video}" playsinline preload="metadata" autoplay muted loop></video>
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
  video.volume = 0;
  // Simplified for archive aesthetic (autoplay muted loop by default without bulky controls)
}

function renderSlideDots(vase) {
  const dots = document.getElementById("slideDots");
  dots.innerHTML = vase.slides.map((slide, index) => `
    <button class="slide-dot ${index === appState.slideIndex ? "is-active" : ""}" data-slide-index="${index}" aria-label="Vue ${index + 1}"></button>
  `).join("");
  dots.querySelectorAll(".slide-dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      const nextIndex = Number(dot.dataset.slideIndex);
      appState.slideDirection = nextIndex >= appState.slideIndex ? 1 : -1;
      appState.slideIndex = nextIndex;
      renderVaseDetail();
    });
  });
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

function moveSlide(direction) {
  const vase = vasesById.get(appState.currentVaseId);
  if (!vase) return;
  appState.slideDirection = direction;
  appState.slideIndex = (appState.slideIndex + direction + vase.slides.length) % vase.slides.length;
  renderVaseDetail();
}

function bindEvents() {
  document.getElementById("prevSlideBtn").addEventListener("click", () => moveSlide(-1));
  document.getElementById("nextSlideBtn").addEventListener("click", () => moveSlide(1));

  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => routeTo(button.dataset.route));
  });

  window.addEventListener("keydown", (event) => {
    if (appState.route !== "vase") return;
    if (event.key === "ArrowLeft") moveSlide(-1);
    if (event.key === "ArrowRight") moveSlide(1);
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
