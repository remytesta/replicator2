const CONFIG = {
  API_URL: "",
  STATUS_INTERVAL: 5000,
};

const appState = {
  route: "home",
  currentVaseId: "argent",
  slideIndex: 0,
  commandState: "idle",
};

const vases = window.REPLICATOR_VASES || [];
const vasesById = new Map(vases.map((vase) => [vase.id, vase]));
const consoleOrder = window.REPLICATOR_CONSOLE_ORDER || vases.map((vase) => vase.id);

const screens = {
  home: document.getElementById("homeScreen"),
  chapel: document.getElementById("chapelScreen"),
  console: document.getElementById("consoleScreen"),
  vase: document.getElementById("vaseScreen"),
};

const transitionLayer = document.getElementById("stageTransition");
const toastEl = document.getElementById("toast");
let toastTimer;

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
  toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 2400);
}

function routeTo(route, options = {}) {
  const nextRoute = route === "vase" ? "vase" : route;
  if (!screens[nextRoute]) return;

  if (options.vaseId) {
    appState.currentVaseId = options.vaseId;
    appState.slideIndex = 0;
    renderVaseDetail();
  }

  transitionLayer.classList.remove("is-running");
  requestAnimationFrame(() => transitionLayer.classList.add("is-running"));

  Object.values(screens).forEach((screen) => screen.classList.remove("is-active", "is-leaving"));
  screens[nextRoute].classList.add("is-active");
  appState.route = nextRoute;

  if (nextRoute === "vase") renderVaseDetail();
  if (!options.silentHash) {
    const hash = nextRoute === "vase" ? `#vase:${appState.currentVaseId}` : `#${nextRoute}`;
    if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
  }
}

function createHomeImage() {
  const wrap = document.getElementById("homeImageWrap");
  wrap.innerHTML = `
    <img src="vase/vase_illustration.png" alt="Illustration du vase Replicator 2">
    <div class="home-orbit orbit-one"></div>
    <div class="home-orbit orbit-two"></div>
  `;
}

function buildPlateauLayer() {
  const layer = document.getElementById("plateauLayer");
  layer.innerHTML = vases.map((vase) => `
    <button class="plateau tone-${vase.tone}" style="--x:${vase.positionOnMap.x}%; --y:${vase.positionOnMap.y}%;" data-vase-id="${vase.id}" type="button">
      <span class="plateau-ring"></span>
      <span class="plateau-core"></span>
      <span class="plateau-label">${vase.title.replace("Vase ", "")}</span>
    </button>
  `).join("");

  layer.querySelectorAll(".plateau").forEach((button) => {
    button.addEventListener("click", () => routeTo("vase", { vaseId: button.dataset.vaseId }));
  });
}

function buildConsole() {
  const grid = document.getElementById("consoleVaseGrid");
  grid.innerHTML = consoleOrder.map((id) => {
    const vase = vasesById.get(id);
    if (!vase) return "";
    return `
      <button class="console-vase tone-${vase.tone}" data-vase-id="${vase.id}" type="button">
        <span></span>
        ${vase.title.replace("Vase ", "")}
      </button>
    `;
  }).join("");

  grid.querySelectorAll(".console-vase").forEach((button) => {
    button.addEventListener("click", () => runVaseHook(button.dataset.vaseId, button));
  });

  const choreoPanel = document.getElementById("choreoPanel");
  choreoPanel.innerHTML = [1, 2, 3, 4].map((id) => `
    <button class="choreo-command" data-choreo-id="${id}" type="button">
      <span>0${id}</span>
      Choregraphie ${id}
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

  if (!vase.gcodeHook) {
    setConsoleStatus(`Aucun G-code direct configure pour ${vase.title}`, "done");
    showToast("Hook G-code a renseigner dans vases-data.js");
    routeTo("vase", { vaseId });
    return;
  }

  await runCommand(button, async () => {
    setConsoleStatus(`Commande ${vase.title} en cours`, "sending");
    if (vase.gcodeHook.endpoint) {
      return api(vase.gcodeHook.endpoint, vase.gcodeHook.method || "POST", vase.gcodeHook.body || null);
    }
    if (vase.gcodeHook.command) {
      return api("/api/gcode", "POST", { command: vase.gcodeHook.command });
    }
    throw new Error("Hook G-code incomplet");
  }, `Commande ${vase.title} terminee`);
}

async function runChoreo(id, button) {
  await runCommand(button, async () => {
    setConsoleStatus(`Envoi choregraphie ${id}`, "sending");
    return api(`/api/choreo/run/${id}`);
  }, `Choregraphie ${id} lancee`);
}

async function runCommand(button, task, successMessage) {
  if (appState.commandState === "sending") return;
  appState.commandState = "sending";
  button.classList.add("is-sending");
  button.disabled = true;

  try {
    await task();
    button.classList.add("is-done");
    setConsoleStatus(successMessage, "done");
    showToast(successMessage);
  } catch (error) {
    button.classList.add("is-error");
    setConsoleStatus(error.message, "error");
    showToast(error.message);
  } finally {
    appState.commandState = "idle";
    setTimeout(() => {
      button.disabled = false;
      button.classList.remove("is-sending", "is-done", "is-error");
    }, 1200);
  }
}

function renderVaseDetail() {
  const vase = vasesById.get(appState.currentVaseId) || vases[0];
  if (!vase) return;
  const slide = vase.slides[appState.slideIndex] || vase.slides[0];
  const vaseIndex = vases.findIndex((item) => item.id === vase.id) + 1;

  document.getElementById("vaseTitle").textContent = vase.title;
  document.getElementById("vaseCount").textContent = `Vase ${vaseIndex} / ${vases.length}`;
  document.getElementById("slideLabel").textContent = slide.title;
  document.getElementById("vaseDescription").textContent = vase.shortDescription;

  const media = document.getElementById("vaseMedia");
  media.className = `vase-media tone-${vase.tone}`;
  media.innerHTML = slide.image
    ? `<img class="vase-image is-rotating" src="${slide.image}" alt="${vase.title} - ${slide.title}">`
    : `<div class="vase-placeholder is-rotating">
        <span>${vase.title}</span>
        <strong>${slide.title}</strong>
      </div>`;

  renderSlideDots(vase);
  renderVaseNav(vase.id);
}

function renderSlideDots(vase) {
  const dots = document.getElementById("slideDots");
  dots.innerHTML = vase.slides.map((slide, index) => `
    <button class="slide-dot ${index === appState.slideIndex ? "is-active" : ""}" data-slide-index="${index}" type="button" aria-label="${slide.title}"></button>
  `).join("");
  dots.querySelectorAll(".slide-dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      appState.slideIndex = Number(dot.dataset.slideIndex);
      renderVaseDetail();
    });
  });
}

function renderVaseNav(activeId) {
  const nav = document.getElementById("vaseNav");
  nav.innerHTML = vases.map((vase) => `
    <button class="vase-chip tone-${vase.tone} ${vase.id === activeId ? "is-active" : ""}" data-vase-id="${vase.id}" type="button">
      ${vase.title.replace("Vase ", "")}
    </button>
  `).join("");
  nav.querySelectorAll(".vase-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      appState.currentVaseId = chip.dataset.vaseId;
      appState.slideIndex = 0;
      renderVaseDetail();
    });
  });
}

function moveSlide(direction) {
  const vase = vasesById.get(appState.currentVaseId);
  if (!vase) return;
  appState.slideIndex = (appState.slideIndex + direction + vase.slides.length) % vase.slides.length;
  renderVaseDetail();
}

function bindEvents() {
  document.getElementById("enterChapelBtn").addEventListener("click", () => routeTo("chapel"));
  document.getElementById("chapelHomeBtn").addEventListener("click", () => routeTo("chapel"));
  document.getElementById("consoleBtn").addEventListener("click", () => routeTo("console"));
  document.getElementById("prevSlideBtn").addEventListener("click", () => moveSlide(-1));
  document.getElementById("nextSlideBtn").addEventListener("click", () => moveSlide(1));

  document.querySelectorAll("[data-route='chapel']").forEach((button) => {
    button.addEventListener("click", () => routeTo("chapel"));
  });

  window.addEventListener("keydown", (event) => {
    if (appState.route !== "vase") return;
    if (event.key === "ArrowLeft") moveSlide(-1);
    if (event.key === "ArrowRight") moveSlide(1);
  });
}

function init() {
  createHomeImage();
  buildPlateauLayer();
  buildConsole();
  renderVaseDetail();
  bindEvents();
  applyInitialHash();
}

init();

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
