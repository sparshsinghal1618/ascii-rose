/* ============================================================
   ASCII ROSE GENERATOR - script.js
   Boots the renderer, the live source console and the controls.
   Everything on screen is generated from the files beside this
   one; there are no image assets and no pre-baked rose.
   ============================================================ */

(function (global) {
  "use strict";

  const AUTO_START_DELAY = 1100;

  function parseSeedFromUrl() {
    let raw = null;

    try {
      const params = new URLSearchParams(global.location.search);
      raw = params.get("seed");
      if (!raw) {
        const hash = global.location.hash.replace(/^#/, "");
        if (hash.indexOf("seed=") === 0) raw = hash.slice(5);
      }
    } catch (error) {
      raw = null;
    }

    if (!raw) return null;
    const cleaned = raw.trim();
    const value = /^0x/i.test(cleaned)
      ? parseInt(cleaned.slice(2), 16)
      : /^[0-9a-f]{8}$/i.test(cleaned) && /[a-f]/i.test(cleaned)
      ? parseInt(cleaned, 16)
      : Number(cleaned);

    if (!Number.isFinite(value)) return null;
    return value >>> 0;
  }

  function showFatal(message) {
    const banner = document.createElement("div");
    banner.className = "noscript";
    banner.textContent = message;
    document.body.insertBefore(banner, document.body.firstChild);
    if (global.console && global.console.error) {
      global.console.error("[ascii-rose]", message);
    }
  }

  function boot() {
    const stage = document.getElementById("stageShell");
    const roseCanvas = document.getElementById("roseCanvas");
    const starCanvas = document.getElementById("starCanvas");

    if (!stage || !roseCanvas || !starCanvas) {
      showFatal("Renderer mount points are missing from the page.");
      return;
    }

    if (!global.RosePetalGenerator || !global.RoseParticleField || !global.AsciiRoseEngine) {
      showFatal("The procedural engine failed to load. Check the script tags in index.html.");
      return;
    }

    const context = roseCanvas.getContext("2d", { alpha: true });
    if (!context) {
      showFatal("This browser cannot create a 2D canvas context.");
      return;
    }

    const urlSeed = parseSeedFromUrl();
    const options = {
      seed: urlSeed == null ? (Math.random() * 0xffffffff) >>> 0 : urlSeed,
      complexity: 1,
      density: 1,
      roseSize: 1,
      speed: 1,
      duration: 12,
      glow: 0.55,
      starDensity: 2.5,
      style: "classic",
      flowerPalette: "crimson",
      leafPalette: "emerald",
    };

    let engine;
    try {
      engine = new global.AsciiRoseEngine({
        stage,
        roseCanvas,
        starCanvas,
        options,
      });
    } catch (error) {
      showFatal(`Engine start-up failed: ${error.message}`);
      return;
    }

    let sourceConsole = null;
    if (global.RoseSourceConsole) {
      sourceConsole = new global.RoseSourceConsole({
        tabs: document.getElementById("codeTabs"),
        lines: document.getElementById("codeLines"),
        scroll: document.getElementById("codeScroll"),
        body: document.getElementById("codeBody"),
        mode: document.getElementById("codeModeLabel"),
        file: document.getElementById("codeFileLabel"),
        stats: document.getElementById("codeStats"),
        autoLamp: document.getElementById("autoScrollLamp"),
      });

      sourceConsole
        .init()
        .catch((error) => {
          if (global.console && global.console.warn) {
            global.console.warn("[ascii-rose] source console:", error);
          }
        });
    }

    const controls = global.RoseControls
      ? new global.RoseControls({ engine, sourceConsole })
      : null;

    global.asciiRose = {
      engine,
      controls,
      sourceConsole,
      version: "2.0",
    };

    const start = () => {
      if (engine.state !== "idle") return;
      engine.start();
    };

    if (document.readyState === "complete") {
      window.setTimeout(start, AUTO_START_DELAY);
    } else {
      window.addEventListener(
        "load",
        () => window.setTimeout(start, AUTO_START_DELAY),
        { once: true }
      );
    }

    // Expose a small deterministic hook for debugging and automated checks.
    global.asciiRose.snapshot = () => ({
      state: engine.state,
      seed: engine.seed,
      glyphs: engine.glyphCount,
      petals: engine.geometry.stats.petals,
      layers: engine.geometry.stats.layers,
      cols: engine.cols,
      rows: engine.rows,
      progress: Math.min(1, engine.elapsed / engine.completeAt),
      sourceMode: sourceConsole ? sourceConsole.liveLoaded : false,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
