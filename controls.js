/* ============================================================
   ASCII ROSE GENERATOR - controls.js
   Wires the transport, sliders, selectors, exports and
   fullscreen behaviour to the live rose engine.
   ============================================================ */

(function (global) {
  "use strict";

  const HEAVY_DELAY = 150;
  const FPS_REFRESH = 150;

  const STATUS_LABELS = {
    idle: "STANDBY",
    running: "LIVE",
    paused: "HALTED",
    complete: "COMPLETE",
  };

  function hexSeed(seed) {
    return (seed >>> 0).toString(16).toUpperCase().padStart(8, "0");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      target.isContentEditable
    );
  }

  class RoseControls {
    constructor(config) {
      this.engine = config.engine;
      this.sourceConsole = config.sourceConsole || null;

      const byId = (id) => document.getElementById(id);
      this.el = {
        app: byId("app"),
        stage: byId("stageShell"),
        statusLamp: byId("statusLamp"),
        statusLabel: byId("statusLabel"),
        seedLabel: byId("seedLabel"),
        hudSeed: byId("hudSeed"),
        footSeed: byId("footSeed"),
        phaseLabel: byId("phaseLabel"),
        fpsLabel: byId("fpsLabel"),
        glyphLabel: byId("glyphLabel"),
        progressFill: byId("progressFill"),
        progressText: byId("progressText"),
        toast: byId("toast"),
        exitFullscreen: byId("exitFullscreenBtn"),
        fullscreen: byId("fullscreenBtn"),
        buttons: {
          start: byId("startBtn"),
          pause: byId("pauseBtn"),
          resume: byId("resumeBtn"),
          restart: byId("restartBtn"),
          reset: byId("resetBtn"),
          newRose: byId("newRoseBtn"),
          downloadTxt: byId("downloadTxtBtn"),
          exportPng: byId("exportPngBtn"),
          copy: byId("copyBtn"),
        },
        sliders: {
          speed: byId("speed"),
          density: byId("density"),
          roseSize: byId("roseSize"),
          complexity: byId("complexity"),
          glow: byId("glow"),
          starDensity: byId("starDensity"),
        },
        outputs: {
          speed: byId("speedOut"),
          density: byId("densityOut"),
          roseSize: byId("roseSizeOut"),
          complexity: byId("complexityOut"),
          glow: byId("glowOut"),
          starDensity: byId("starDensityOut"),
        },
        selects: {
          style: byId("charStyle"),
          flower: byId("flowerPalette"),
          leaf: byId("leafPalette"),
        },
      };

      this.pseudoFullscreen = false;
      this._toastTimer = null;
      this._heavyTimers = new Map();
      this._pendingHeavy = new Map();
      this._lastFpsPaint = 0;

      this._bindTransport();
      this._bindSliders();
      this._bindSelectors();
      this._bindActions();
      this._bindFullscreen();
      this._bindKeyboard();

      this._applyOptionsToUI();
      this.engine.onUpdate = (payload) => this.render(payload);
      this._paintInitial();
    }

    /* ---------- helpers ---------- */

    showToast(message, tone) {
      const toast = this.el.toast;
      if (!toast) return;
      toast.textContent = message;
      toast.classList.remove("is-visible", "is-success");
      // force a reflow so the entrance animation can replay
      void toast.offsetWidth;
      toast.classList.add("is-visible");
      if (tone === "success") toast.classList.add("is-success");
      window.clearTimeout(this._toastTimer);
      this._toastTimer = window.setTimeout(() => {
        toast.classList.remove("is-visible", "is-success");
      }, 2800);
    }

    _replaySource() {
      if (!this.sourceConsole) return;
      this.sourceConsole.select(this.sourceConsole.current);
    }

    _paintInitial() {
      const engine = this.engine;
      this.render({
        state: engine.state,
        progress: 0,
        elapsed: engine.elapsed,
        completeAt: engine.completeAt,
        fps: engine.fps,
        glyphs: engine.glyphCount,
        seed: engine.options.seed,
        phase: "AWAITING SIGNAL",
        petals: engine.geometry.stats.petals,
        layers: engine.geometry.stats.layers,
      });
    }

    _applyOptionsToUI() {
      const options = this.engine.options;
      const sliders = this.el.sliders;
      const outputs = this.el.outputs;

      if (sliders.speed) sliders.speed.value = options.speed;
      if (sliders.density) sliders.density.value = options.density;
      if (sliders.roseSize) sliders.roseSize.value = options.roseSize;
      if (sliders.complexity) sliders.complexity.value = options.complexity;
      if (sliders.glow) sliders.glow.value = options.glow;
      if (sliders.starDensity) sliders.starDensity.value = options.starDensity;

      if (outputs.speed) outputs.speed.textContent = `${options.speed.toFixed(2)}\u00d7`;
      if (outputs.density) outputs.density.textContent = `${options.density.toFixed(2)}\u00d7`;
      if (outputs.roseSize) outputs.roseSize.textContent = `${options.roseSize.toFixed(2)}\u00d7`;
      if (outputs.complexity) outputs.complexity.textContent = options.complexity.toFixed(2);
      if (outputs.glow) outputs.glow.textContent = options.glow.toFixed(2);
      if (outputs.starDensity) outputs.starDensity.textContent = `${options.starDensity.toFixed(2)}\u00d7`;

      if (this.el.selects.style) this.el.selects.style.value = options.style;
      if (this.el.selects.flower) this.el.selects.flower.value = options.flowerPalette;
      if (this.el.selects.leaf) this.el.selects.leaf.value = options.leafPalette;
    }

    /* ---------- transport ---------- */

    _bindTransport() {
      const buttons = this.el.buttons;

      if (buttons.start) {
        buttons.start.addEventListener("click", () => {
          this.engine.start();
          this._replaySource();
        });
      }

      if (buttons.pause) {
        buttons.pause.addEventListener("click", () => this.engine.pause());
      }
      if (buttons.resume) {
        buttons.resume.addEventListener("click", () => this.engine.resume());
      }

      if (buttons.restart) {
        buttons.restart.addEventListener("click", () => {
          this.engine.restart();
          this._replaySource();
          this.showToast("SEQUENCE RESTARTED", "success");
        });
      }

      if (buttons.reset) {
        buttons.reset.addEventListener("click", () => {
          this.engine.reset();
          this._replaySource();
          this.showToast("SIMULATION RESET");
        });
      }
    }

    /* ---------- sliders ---------- */

    _bindSliders() {
      const sliders = this.el.sliders;
      const outputs = this.el.outputs;

      const onRange = (input, callback, formatter) => {
        if (!input) return;
        const paint = () => {
          const value = parseFloat(input.value);
          if (outputs[input.id]) outputs[input.id].textContent = formatter(value);
          callback(value);
        };
        input.addEventListener("input", paint);
      };

      onRange(sliders.speed, (value) => this.engine.setSpeed(value), (v) => `${v.toFixed(2)}\u00d7`);
      onRange(sliders.glow, (value) => this.engine.setGlow(value), (v) => v.toFixed(2));
      onRange(
        sliders.starDensity,
        (value) => this.engine.setStarDensity(value),
        (v) => `${v.toFixed(2)}\u00d7`
      );
      onRange(
        sliders.density,
        (value) => this._scheduleHeavy("density", value),
        (v) => `${v.toFixed(2)}\u00d7`
      );
      onRange(
        sliders.roseSize,
        (value) => this._scheduleHeavy("roseSize", value),
        (v) => `${v.toFixed(2)}\u00d7`
      );
      onRange(
        sliders.complexity,
        (value) => this._scheduleHeavy("complexity", value),
        (v) => v.toFixed(2)
      );

      // Commit the final value the moment the user lets go.
      Object.keys(sliders).forEach((key) => {
        const input = sliders[key];
        if (!input) return;
        input.addEventListener("change", () => {
          if (!this._pendingHeavy.has(key)) return;
          const value = this._pendingHeavy.get(key);
          this._pendingHeavy.delete(key);
          window.clearTimeout(this._heavyTimers.get(key));
          this._heavyTimers.delete(key);
          this._applyHeavy(key, value);
        });
      });
    }

    _scheduleHeavy(key, value) {
      this._pendingHeavy.set(key, value);
      window.clearTimeout(this._heavyTimers.get(key));
      const timer = window.setTimeout(() => {
        this._heavyTimers.delete(key);
        if (!this._pendingHeavy.has(key)) return;
        const pending = this._pendingHeavy.get(key);
        this._pendingHeavy.delete(key);
        this._applyHeavy(key, pending);
      }, HEAVY_DELAY);
      this._heavyTimers.set(key, timer);
    }

    _applyHeavy(key, value) {
      if (key === "density") this.engine.setDensity(value);
      else if (key === "roseSize") this.engine.setRoseSize(value);
      else if (key === "complexity") this.engine.setComplexity(value);
    }

    /* ---------- selectors ---------- */

    _bindSelectors() {
      const selects = this.el.selects;

      if (selects.style) {
        selects.style.addEventListener("change", () => {
          this.engine.setStyle(selects.style.value);
          this.showToast(`STYLE / ${selects.style.value.toUpperCase()}`, "success");
        });
      }

      if (selects.flower) {
        selects.flower.addEventListener("change", () => {
          this.engine.setFlowerPalette(selects.flower.value);
          this.showToast(`FLOWER PALETTE / ${selects.flower.value.toUpperCase()}`, "success");
        });
      }

      if (selects.leaf) {
        selects.leaf.addEventListener("change", () => {
          this.engine.setLeafPalette(selects.leaf.value);
          this.showToast(`LEAF PALETTE / ${selects.leaf.value.toUpperCase()}`, "success");
        });
      }
    }

    /* ---------- actions ---------- */

    _bindActions() {
      const buttons = this.el.buttons;

      if (buttons.newRose) {
        buttons.newRose.addEventListener("click", () => {
          this.engine.newVariation();
          this._replaySource();
          this.showToast(`NEW GENOME / 0x${hexSeed(this.engine.seed)}`, "success");
        });
      }

      if (buttons.downloadTxt) {
        buttons.downloadTxt.addEventListener("click", () => {
          try {
            const filename = this.engine.downloadTXT();
            this.showToast(`${filename} DOWNLOADED`, "success");
          } catch (error) {
            this.showToast("TXT EXPORT FAILED", "error");
          }
        });
      }

      if (buttons.exportPng) {
        buttons.exportPng.addEventListener("click", async () => {
          if (buttons.exportPng.disabled) return;
          const original = buttons.exportPng.querySelector("span:last-child");
          buttons.exportPng.disabled = true;
          if (original) original.textContent = "RENDERING...";
          try {
            const filename = await this.engine.exportPNG();
            this.showToast(`${filename} EXPORTED`, "success");
          } catch (error) {
            this.showToast("PNG EXPORT FAILED", "error");
          } finally {
            buttons.exportPng.disabled = false;
            if (original) original.textContent = "EXPORT .PNG";
          }
        });
      }

      if (buttons.copy) {
        buttons.copy.addEventListener("click", async () => {
          const ascii = this.engine.getASCII();
          if (!ascii) {
            this.showToast("NOTHING TO COPY YET", "error");
            return;
          }

          try {
            if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
              await global.navigator.clipboard.writeText(ascii);
            } else {
              this._legacyCopy(ascii);
            }
            this.showToast(`COPIED ${ascii.length.toLocaleString("en-US")} CHARS`, "success");
          } catch (error) {
            try {
              this._legacyCopy(ascii);
              this.showToast("COPIED ASCII TO CLIPBOARD", "success");
            } catch (fallbackError) {
              this.showToast("CLIPBOARD BLOCKED BY BROWSER", "error");
            }
          }
        });
      }
    }

    _legacyCopy(text) {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.top = "-1000px";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      if (!ok) throw new Error("copy command rejected");
    }

    /* ---------- fullscreen ---------- */

    _bindFullscreen() {
      const stage = this.el.stage;

      if (this.el.fullscreen) {
        this.el.fullscreen.addEventListener("click", () => this.toggleFullscreen());
      }
      if (this.el.exitFullscreen) {
        this.el.exitFullscreen.addEventListener("click", () => this.exitFullscreen());
      }

      document.addEventListener("fullscreenchange", () => {
        if (document.fullscreenElement) {
          this.pseudoFullscreen = false;
          stage.classList.remove("pseudo-fullscreen");
          document.body.classList.remove("is-locked");
        } else if (!this.pseudoFullscreen) {
          stage.classList.remove("pseudo-fullscreen");
          document.body.classList.remove("is-locked");
        }
        this._refreshFullscreenButton();
        this._nudgeResize();
      });

      document.addEventListener("webkitfullscreenchange", () => {
        this._refreshFullscreenButton();
        this._nudgeResize();
      });
    }

    isFullscreen() {
      return Boolean(document.fullscreenElement) || this.pseudoFullscreen;
    }

    toggleFullscreen() {
      if (this.isFullscreen()) {
        this.exitFullscreen();
        return;
      }

      const stage = this.el.stage;
      const request =
        stage.requestFullscreen ||
        stage.webkitRequestFullscreen ||
        stage.msRequestFullscreen;

      if (request) {
        const result = request.call(stage, { navigationUI: "hide" });
        if (result && typeof result.catch === "function") {
          result
            .then(() => {
              this._refreshFullscreenButton();
              this._nudgeResize();
            })
            .catch(() => this._enterPseudoFullscreen());
        }
      } else {
        this._enterPseudoFullscreen();
      }
    }

    _enterPseudoFullscreen() {
      this.pseudoFullscreen = true;
      this.el.stage.classList.add("pseudo-fullscreen");
      document.body.classList.add("is-locked");
      this._refreshFullscreenButton();
      this._nudgeResize();
    }

    exitFullscreen() {
      if (this.pseudoFullscreen) {
        this.pseudoFullscreen = false;
        this.el.stage.classList.remove("pseudo-fullscreen");
        document.body.classList.remove("is-locked");
        this._refreshFullscreenButton();
        this._nudgeResize();
        return;
      }

      const exit =
        document.exitFullscreen ||
        document.webkitExitFullscreen ||
        document.msExitFullscreen;

      if (exit && (document.fullscreenElement || document.webkitFullscreenElement)) {
        const result = exit.call(document);
        if (result && typeof result.catch === "function") result.catch(() => {});
      }
    }

    _refreshFullscreenButton() {
      const active = this.isFullscreen();
      if (this.el.fullscreen) {
        this.el.fullscreen.setAttribute("aria-pressed", active ? "true" : "false");
      }
      if (this.el.stage) {
        this.el.stage.setAttribute("data-fullscreen", active ? "on" : "off");
      }
    }

    _nudgeResize() {
      window.clearTimeout(this._resizeNudge);
      this._resizeNudge = window.setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 260);
    }

    /* ---------- keyboard ---------- */

    _bindKeyboard() {
      document.addEventListener("keydown", (event) => {
        if (event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.altKey) return;

        if (event.key === "Escape") {
          if (this.pseudoFullscreen) {
            event.preventDefault();
            this.exitFullscreen();
          }
          return;
        }

        if (isTypingTarget(event.target)) return;

        const key = event.key.toLowerCase();

        if (event.code === "Space" || key === " ") {
          event.preventDefault();
          if (this.engine.state === "paused") this.engine.resume();
          else if (this.engine.state === "running" || this.engine.state === "complete") {
            this.engine.pause();
          } else {
            this.engine.start();
            this._replaySource();
          }
          return;
        }

        if (key === "r") {
          event.preventDefault();
          this.engine.restart();
          this._replaySource();
          this.showToast("SEQUENCE RESTARTED", "success");
        } else if (key === "n") {
          event.preventDefault();
          this.engine.newVariation();
          this._replaySource();
          this.showToast(`NEW GENOME / 0x${hexSeed(this.engine.seed)}`, "success");
        } else if (key === "f") {
          event.preventDefault();
          this.toggleFullscreen();
        }
      });
    }

    /* ---------- render ---------- */

    render(payload) {
      if (!payload) return;
      const state = payload.state;
      const el = this.el;

      if (el.statusLamp) {
        el.statusLamp.classList.toggle("is-running", state === "running");
        el.statusLamp.classList.toggle("is-paused", state === "paused");
        el.statusLamp.classList.toggle("is-complete", state === "complete");
      }
      if (el.statusLabel) el.statusLabel.textContent = STATUS_LABELS[state] || "STANDBY";
      if (el.phaseLabel) el.phaseLabel.textContent = payload.phase;

      const seedText = `0x${hexSeed(payload.seed)}`;
      if (el.seedLabel) el.seedLabel.textContent = hexSeed(payload.seed);
      if (el.hudSeed) el.hudSeed.textContent = seedText;
      if (el.footSeed) el.footSeed.textContent = `GENOME ${seedText}`;

      const progress = clamp(payload.progress || 0, 0, 1);
      const percent = Math.round(progress * 100);
      if (el.progressFill) el.progressFill.style.width = `${progress * 100}%`;
      if (el.progressText) el.progressText.textContent = `${percent}%`;

      if (el.glyphLabel) {
        el.glyphLabel.textContent = `${(payload.glyphs || 0).toLocaleString("en-US")} GLYPHS`;
      }

      const now = performance.now();
      if (now - this._lastFpsPaint > FPS_REFRESH) {
        this._lastFpsPaint = now;
        if (el.fpsLabel) el.fpsLabel.textContent = `${Math.round(payload.fps || 0)} FPS`;
      }

      this._renderTransport(state);
    }

    _renderTransport(state) {
      const buttons = this.el.buttons;
      const start = buttons.start;
      const pause = buttons.pause;
      const resume = buttons.resume;

      if (start) {
        start.disabled = state === "running" || state === "paused";
        start.setAttribute("aria-disabled", start.disabled ? "true" : "false");
      }
      if (pause) {
        pause.disabled = !(state === "running" || state === "complete");
        pause.setAttribute("aria-disabled", pause.disabled ? "true" : "false");
      }
      if (resume) {
        resume.disabled = state !== "paused";
        resume.setAttribute("aria-disabled", resume.disabled ? "true" : "false");
      }
    }
  }

  global.RoseControls = RoseControls;
})(typeof window !== "undefined" ? window : globalThis);
