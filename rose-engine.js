/* ============================================================
   ASCII ROSE GENERATOR — rose-engine.js
   The renderer. Builds a character field from procedural vector
   botany, animates it char-by-char, and handles export.

   Pipeline
   -------
   1. RosePetalGenerator -> petals / stem / leaves (world units)
   2. paint the geometry into three offscreen canvases
      (flower, leaves, stem) at supersampled character resolution
   3. sample coverage + colour + luminance into a character grid
   4. choose a glyph from the active style using tone / edge / hash
   5. animate each glyph with its own birth time, fade, sway, glow
   ============================================================ */

(function (global) {
  "use strict";

  const TAU = Math.PI * 2;
  const CELL_ASPECT = 1.58;
  const SUPER_SAMPLE = 3;
  const FONT_STACK =
    '"Cascadia Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace';

  const TIMING = {
    stemStart: 0.45,
    stemDuration: 1.68,
    leafStart: 1.82,
    leafDuration: 1.25,
    flowerStart: 2.3,
    flowerDuration: 2.72,
    fade: 0.44,
    starsDuration: 1.8,
  };

  /* ============================================================
     PALETTES
     ============================================================ */

  const FLOWER_PALETTES = {
    crimson: {
      label: "CRIMSON SIGNAL",
      deep: "#210208",
      dark: "#4d0615",
      mid: "#8c0e28",
      bright: "#d41c43",
      hot: "#ff4166",
      pale: "#ffb8c6",
      spark: ["#ff365c", "#ff8fa8", "#ffe0e6", "#ffffff"],
    },
    neon: {
      label: "NEON ROSE",
      deep: "#1e0018",
      dark: "#4d0032",
      mid: "#a6005e",
      bright: "#f2177f",
      hot: "#ff5cc8",
      pale: "#ffd1f1",
      spark: ["#ff2f9c", "#ff5cc8", "#ffd1f1", "#ffffff"],
    },
    blood: {
      label: "DEEP BLOOD",
      deep: "#160103",
      dark: "#3d0407",
      mid: "#79080d",
      bright: "#c4171d",
      hot: "#f03b32",
      pale: "#ffb3a4",
      spark: ["#e31b23", "#ff6b5e", "#ffc3b8", "#ffffff"],
    },
    ember: {
      label: "EMBER FLARE",
      deep: "#1d0602",
      dark: "#4d1204",
      mid: "#97270a",
      bright: "#e64918",
      hot: "#ff833f",
      pale: "#ffd6ad",
      spark: ["#ff5a1f", "#ff9a5c", "#ffd6ad", "#ffffff"],
    },
    blush: {
      label: "PALE BLUSH",
      deep: "#2f0d18",
      dark: "#5c1b2d",
      mid: "#963650",
      bright: "#cf6480",
      hot: "#ff9eb2",
      pale: "#ffe4ea",
      spark: ["#ff8fa8", "#ffb8c6", "#ffe4ea", "#ffffff"],
    },
    wine: {
      label: "WINE NOIR",
      deep: "#120108",
      dark: "#360516",
      mid: "#680d2b",
      bright: "#a5174a",
      hot: "#dc2f68",
      pale: "#ff9ab4",
      spark: ["#c9245c", "#ff6d98", "#ffc0d0", "#ffffff"],
    },
  };

  const LEAF_PALETTES = {
    emerald: {
      label: "EMERALD",
      deep: "#041c12",
      dark: "#063b24",
      mid: "#0f7a4a",
      bright: "#1fbf74",
      hot: "#5cffb0",
      pale: "#c9ffe3",
      spark: ["#35e08c", "#84ffc0", "#c9ffe3", "#ffffff"],
    },
    jade: {
      label: "JADE CIRCUIT",
      deep: "#041a1a",
      dark: "#063b36",
      mid: "#0e796f",
      bright: "#1fbfae",
      hot: "#6dffe8",
      pale: "#d2fffa",
      spark: ["#28d9c4", "#6dffe8", "#d2fffa", "#ffffff"],
    },
    acid: {
      label: "ACID GREEN",
      deep: "#0b1a04",
      dark: "#1d3a08",
      mid: "#4f7a0f",
      bright: "#8fd11f",
      hot: "#c6ff4f",
      pale: "#f0ffc2",
      spark: ["#a8f02c", "#c6ff4f", "#f0ffc2", "#ffffff"],
    },
    forest: {
      label: "DEEP FOREST",
      deep: "#03130b",
      dark: "#062817",
      mid: "#0a4c2c",
      bright: "#137a48",
      hot: "#2ebd72",
      pale: "#a8ffd0",
      spark: ["#1e9e60", "#4ee298", "#a8ffd0", "#ffffff"],
    },
    mint: {
      label: "MINT GLOW",
      deep: "#082019",
      dark: "#0b3b2c",
      mid: "#156b50",
      bright: "#2aa47a",
      hot: "#6fe3b4",
      pale: "#dcfff1",
      spark: ["#4cd6a2", "#8fffd0", "#dcfff1", "#ffffff"],
    },
  };

  /* ============================================================
     CHARACTER STYLES
     ============================================================ */

  const STYLES = {
    classic: {
      label: "CLASSIC",
      fill: ".,:;+*xX#%@",
      edgeV: "|",
      edgeH: "-",
      edgeA: "/",
      edgeB: "\\",
      edgeHeavy: "#",
      accents: ["@", "#", "%", "&", "*"],
    },
    cyber: {
      label: "CYBER",
      fill: ".,:;01+=*#%&@",
      edgeV: "|",
      edgeH: "-",
      edgeA: "/",
      edgeB: "\\",
      edgeHeavy: "@",
      accents: ["0", "1", "$", "^", "&"],
    },
    organic: {
      label: "ORGANIC",
      fill: ".,'~:;+*x%&@",
      edgeV: "|",
      edgeH: "~",
      edgeA: "/",
      edgeB: "\\",
      edgeHeavy: "%",
      accents: ["&", "%", "@", "*", "x"],
    },
    digital: {
      label: "DIGITAL",
      fill: "0123456789ABCDEF",
      edgeV: "1",
      edgeH: "0",
      edgeA: "/",
      edgeB: "\\",
      edgeHeavy: "F",
      accents: ["0", "1", "X", "$", "&"],
    },
    minimal: {
      label: "MINIMAL",
      fill: ".,:;+*#",
      edgeV: "|",
      edgeH: "-",
      edgeA: "/",
      edgeB: "\\",
      edgeHeavy: "#",
      accents: ["+", "*", "#"],
    },
    gothic: {
      label: "GOTHIC",
      fill: ".,:;xX#%@",
      edgeV: "|",
      edgeH: "-",
      edgeA: "/",
      edgeB: "\\",
      edgeHeavy: "X",
      accents: ["X", "#", "@", "&", "%"],
    },
  };

  /* ============================================================
     HELPERS
     ============================================================ */

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function parseHex(hex) {
    const value = hex.replace("#", "");
    const full =
      value.length === 3
        ? value
            .split("")
            .map((ch) => ch + ch)
            .join("")
        : value;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    };
  }

  function rgba(hex, alpha) {
    const c = parseHex(hex);
    return `rgba(${c.r},${c.g},${c.b},${alpha})`;
  }

  function luma(hex) {
    const c = parseHex(hex);
    return (c.r * 0.299 + c.g * 0.587 + c.b * 0.114) / 255;
  }

  function paletteMaxLuma(palette) {
    return Math.max(
      luma(palette.hot),
      luma(palette.pale),
      luma(palette.bright),
      luma(palette.mid),
      0.1
    );
  }

  function hash3(x, y, seed) {
    let h =
      Math.imul(x + 1, 374761393) ^
      Math.imul(y + 1, 668265263) ^
      Math.imul((seed + 1) >>> 0, 362437);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1400);
  }

  function hexSeed(seed) {
    return (seed >>> 0).toString(16).toUpperCase().padStart(8, "0");
  }

  /* ============================================================
     ENGINE
     ============================================================ */

  class AsciiRoseEngine {
    constructor(config) {
      const settings = config || {};
      this.stage = settings.stage;
      this.roseCanvas = settings.roseCanvas;
      this.starCanvas = settings.starCanvas;
      this.ctx = this.roseCanvas.getContext("2d", { alpha: true });

      this.options = Object.assign(
        {
          seed: (Math.random() * 0xffffffff) >>> 0,
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
          debug: false,
        },
        settings.options || {}
      );

      this.style = STYLES[this.options.style] || STYLES.classic;
      this.flowerPalette =
        FLOWER_PALETTES[this.options.flowerPalette] || FLOWER_PALETTES.crimson;
      this.leafPalette =
        LEAF_PALETTES[this.options.leafPalette] || LEAF_PALETTES.emerald;
      this._flowerMaxLuma = paletteMaxLuma(this.flowerPalette);
      this._leafMaxLuma = paletteMaxLuma(this.leafPalette);

      this.state = "idle";
      this.elapsed = 0;
      this.visualTime = 0;
      this.completeAt = 6;
      this.fps = 60;
      this.glyphCount = 0;
      this.field = [];
      this.cols = 0;
      this.rows = 0;
      this.cellW = 6;
      this.cellH = 9;
      this.fontPx = 8;
      this.W = 1;
      this.H = 1;
      this.dpr = 1;
      this._lastNotify = 0;
      this._pausedDirty = true;
      this._idleDirty = true;
      this._bloomAt = null;
      this._completeFired = false;
      this._sparkClock = 0;
      this._resumeState = "running";
      this._resizeTimer = null;
      this._lastFrame = performance.now();
      this._ambientLayer = null;
      this._ambientGlyphs = [];
      this._ambientStamp = "";

      this.particles = new global.RoseParticleField(this.starCanvas, {
        density: this.options.starDensity,
      });
      this.particles.setDensity(this.options.starDensity);

      this.geometry = global.RosePetalGenerator.generate({
        seed: this.options.seed,
        complexity: this.options.complexity,
      });

      this._applyGlow();
      this._applyResize(true);

      this.onUpdate = null;
      this._boundLoop = this._loop.bind(this);
      this._raf = requestAnimationFrame(this._boundLoop);

      this._onResize = this._onResize.bind(this);
      this._onVisibility = this._onVisibility.bind(this);

      if (typeof ResizeObserver !== "undefined") {
        this._resizeObserver = new ResizeObserver(this._onResize);
        this._resizeObserver.observe(this.stage);
      } else {
        window.addEventListener("resize", this._onResize);
      }
      window.addEventListener("resize", this._onResize);
      document.addEventListener("visibilitychange", this._onVisibility);
    }

    /* ---------- options ---------- */

    _applyGlow() {
      const value = clamp(this.options.glow, 0, 1);
      this.stage.style.setProperty("--glow-alpha", value.toFixed(3));
    }

    setSpeed(value) {
      this.options.speed = clamp(value, 0.1, 5);
      this._notify(true);
    }

    setGlow(value) {
      this.options.glow = clamp(value, 0, 1);
      this._applyGlow();
      this._notify(true);
    }

    setStarDensity(value) {
      this.options.starDensity = clamp(value, 0.2, 2.5);
      this.particles.setDensity(this.options.starDensity);
      this._notify(true);
    }

    setDensity(value) {
      this.options.density = clamp(value, 0.4, 2);
      this._rebuildAll();
    }

    setRoseSize(value) {
      this.options.roseSize = clamp(value, 0.5, 1.4);
      this._rebuildAll();
    }

    setComplexity(value) {
      this.options.complexity = clamp(value, 0, 1);
      this._rebuildAll();
    }

    setStyle(key) {
      if (!STYLES[key]) return;
      this.options.style = key;
      this.style = STYLES[key];
      this._rebuildAll();
    }

    setFlowerPalette(key) {
      if (!FLOWER_PALETTES[key]) return;
      this.options.flowerPalette = key;
      this.flowerPalette = FLOWER_PALETTES[key];
      this._flowerMaxLuma = paletteMaxLuma(this.flowerPalette);
      this._rebuildAll();
    }

    setLeafPalette(key) {
      if (!LEAF_PALETTES[key]) return;
      this.options.leafPalette = key;
      this.leafPalette = LEAF_PALETTES[key];
      this._leafMaxLuma = paletteMaxLuma(this.leafPalette);
      this._rebuildAll();
    }

    /* ---------- transport ---------- */

    _resetRunState() {
      this.elapsed = 0;
      this.visualTime = 0;
      this._bloomAt = null;
      this._completeFired = false;
      this._sparkClock = 0;
      this._pausedDirty = true;
      this.particles.reset();
    }

    start() {
      if (this.state === "running") return;
      if (this.state === "paused") {
        this.resume();
        return;
      }
      this._resetRunState();
      this.state = "running";
      this._notify(true);
    }

    restart() {
      this._resetRunState();
      this.state = "running";
      this._notify(true);
    }

    pause() {
      if (this.state !== "running" && this.state !== "complete") return;
      this._resumeState = this.state;
      this.state = "paused";
      this._pausedDirty = true;
      this._notify(true);
    }

    resume() {
      if (this.state !== "paused") return;
      this.state = this._resumeState || "running";
      this._pausedDirty = true;
      this._notify(true);
    }

    reset() {
      this.state = "idle";
      this.elapsed = 0;
      this.visualTime = 0;
      this._bloomAt = null;
      this._completeFired = false;
      this._sparkClock = 0;
      this.particles.reset();
      this.ctx.clearRect(0, 0, this.W, this.H);
      this._idleDirty = true;
      this._pausedDirty = true;
      this._notify(true);
    }

    newVariation(seed) {
      this.options.seed =
        seed == null ? (Math.random() * 0xffffffff) >>> 0 : seed >>> 0;
      this._rebuildAll();
      this.restart();
    }

    setSeed(seed) {
      this.options.seed = seed >>> 0;
      this._rebuildAll();
    }

    get seed() {
      return this.options.seed;
    }

    /* ---------- notifications ---------- */

    _phaseText() {
      if (this.state === "idle") return "AWAITING SIGNAL";
      if (this.state === "paused") return "SIMULATION HALTED";
      if (this.state === "complete") return "BLOOM COMPLETE";
      if (this.elapsed < 0.4) return "IGNITION";
      if (this.elapsed < 1.8) return "STARFIELD SEEDING";
      if (this.elapsed < 2.35) return "STEM GROWTH";
      if (this.elapsed < 3.15) return "LEAF UNFURL";
      return "PETAL EXPANSION";
    }

    _notify(force) {
      const now = performance.now();
      if (!force && now - this._lastNotify < 150) return;
      this._lastNotify = now;
      if (!this.onUpdate) return;
      this.onUpdate({
        state: this.state,
        progress:
          this.state === "idle"
            ? 0
            : clamp(this.elapsed / Math.max(0.001, this.completeAt), 0, 1),
        elapsed: this.elapsed,
        completeAt: this.completeAt,
        fps: this.fps,
        glyphs: this.glyphCount,
        seed: this.options.seed,
        phase: this._phaseText(),
        petals: this.geometry.stats.petals,
        layers: this.geometry.stats.layers,
      });
    }

    /* ---------- layout / rasterisation ---------- */

    _onResize() {
      if (this._resizeTimer) clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        this._resizeTimer = null;
        this._applyResize(false);
      }, 130);
    }

    _onVisibility() {
      if (!document.hidden) {
        this._lastFrame = performance.now();
        this._pausedDirty = true;
      }
    }

    _applyResize(force) {
      const rect = this.stage.getBoundingClientRect();
      const width = Math.max(280, rect.width);
      const height = Math.max(280, rect.height);
      const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
      const changed =
        force ||
        Math.abs(width - this.W) > 0.5 ||
        Math.abs(height - this.H) > 0.5 ||
        dpr !== this.dpr;

      if (!changed) return;

      this.W = width;
      this.H = height;
      this.dpr = dpr;

      this.roseCanvas.width = Math.round(width * dpr);
      this.roseCanvas.height = Math.round(height * dpr);
      this.roseCanvas.style.width = `${width}px`;
      this.roseCanvas.style.height = `${height}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      this.particles.resize(width, height, dpr);
      this._computeLayout();
      this._ambientLayer = null;
      this._ambientGlyphs = [];
      this._buildField();

      if (this.state === "complete") {
        this.elapsed = Math.max(this.elapsed, this.completeAt + 0.2);
      }

      this._pausedDirty = true;
      this._idleDirty = true;
      this._notify(true);
    }

    _worldToScreen(point) {
      return {
        x: this.layout.originX + point.x * this.layout.scale,
        y: this.layout.originY + point.y * this.layout.scale,
      };
    }

    _computeLayout() {
      const geom = this.geometry;
      const bounds = geom.bounds;
      const fit = Math.min(
        (this.W * 0.86) / Math.max(0.001, bounds.width),
        (this.H * 0.85) / Math.max(0.001, bounds.height)
      );
      const scale = fit * this.options.roseSize;
      const originX =
        this.W / 2 - ((bounds.minX + bounds.maxX) / 2) * scale;
      const originY =
        this.H / 2 - ((bounds.minY + bounds.maxY) / 2) * scale;

      this.layout = {
        scale,
        originX,
        originY,
        bounds,
        flowerRadiusPx: geom.R * scale,
      };
      this.layout.flowerCenter = this._worldToScreen(geom.flower.center);

      const narrow = this.W < 640;
      const baseCell = narrow ? 3.05 : 5.05;
      let cols = Math.round((this.W / baseCell) * this.options.density);
      cols = clamp(cols, narrow ? 86 : 118, narrow ? 186 : 350);

      let rows = Math.round(
        this.H / ((this.W / cols) * CELL_ASPECT)
      );
      rows = clamp(rows, 48, 162);

      this.cols = cols;
      this.rows = rows;
      this.cellW = this.W / cols;
      this.cellH = this.H / rows;
      this.fontPx = Math.max(4.2, this.cellH * 1.02);
    }

    _rebuildAll() {
      this.geometry = global.RosePetalGenerator.generate({
        seed: this.options.seed,
        complexity: this.options.complexity,
      });
      this._computeLayout();
      this._ambientLayer = null;
      this._ambientGlyphs = [];
      this._buildField();

      if (
        this.state === "complete" ||
        (this.state === "paused" && this._resumeState === "complete")
      ) {
        this.elapsed = Math.max(this.elapsed, this.completeAt + 0.2);
      }

      this._pausedDirty = true;
      this._idleDirty = true;
      this._notify(true);
    }

    _buildField() {
      const geom = this.geometry;
      const layout = this.layout;
      const style = this.style;
      const fpal = this.flowerPalette;
      const lpal = this.leafPalette;
      const cols = this.cols;
      const rows = this.rows;
      const SS = SUPER_SAMPLE;
      const ow = cols * SS;
      const oh = rows * SS;
      const W = this.W;
      const H = this.H;
      const sx = ow / W;
      const sy = oh / H;
      const seed = this.options.seed;

      const map = (p) => ({
        x: (layout.originX + p.x * layout.scale) * sx,
        y: (layout.originY + p.y * layout.scale) * sy,
      });

      const makeCanvas = () => {
        const canvas = document.createElement("canvas");
        canvas.width = ow;
        canvas.height = oh;
        const ctx2 = canvas.getContext("2d", { willReadFrequently: true });
        ctx2.lineJoin = "round";
        ctx2.lineCap = "round";
        return { canvas, ctx: ctx2 };
      };

      const pathOf = (points) => {
        const path = new Path2D();
        if (!points.length) return path;
        path.moveTo(map(points[0]).x, map(points[0]).y);
        for (let i = 1; i < points.length; i += 1) {
          const p = map(points[i]);
          path.lineTo(p.x, p.y);
        }
        path.closePath();
        return path;
      };

      const layers = {
        stem: makeCanvas(),
        leaves: makeCanvas(),
        flower: makeCanvas(),
      };

      /* ----- stem ----- */
      const stemCtx = layers.stem.ctx;
      const stemPath = pathOf(geom.stem.outline);
      const stemOff = geom.stem.outline.map(map);
      let sxMin = Infinity;
      let sxMax = -Infinity;
      let syMid = 0;
      for (const p of stemOff) {
        if (p.x < sxMin) sxMin = p.x;
        if (p.x > sxMax) sxMax = p.x;
        syMid += p.y / stemOff.length;
      }
      const stemGrad = stemCtx.createLinearGradient(
        sxMin,
        syMid,
        Math.max(sxMin + 1, sxMax),
        syMid
      );
      stemGrad.addColorStop(0, lpal.deep);
      stemGrad.addColorStop(0.28, lpal.dark);
      stemGrad.addColorStop(0.68, lpal.mid);
      stemGrad.addColorStop(1, lpal.bright);
      stemCtx.fillStyle = stemGrad;
      stemCtx.fill(stemPath);
      stemCtx.strokeStyle = rgba(lpal.deep, 0.94);
      stemCtx.lineWidth = SS * 1.05;
      stemCtx.stroke(stemPath);

      stemCtx.strokeStyle = rgba(lpal.hot, 0.62);
      stemCtx.lineWidth = SS * 0.48;
      stemCtx.stroke(pathOf(geom.stem.highlight));

      stemCtx.strokeStyle = rgba(lpal.deep, 0.62);
      stemCtx.lineWidth = SS * 0.42;
      geom.stem.nodes.forEach((node) => stemCtx.stroke(pathOf(node)));

      geom.stem.thorns.forEach((thorn) => {
        const path = pathOf(thorn);
        stemCtx.fillStyle = rgba(lpal.mid, 0.96);
        stemCtx.fill(path);
        stemCtx.strokeStyle = rgba(lpal.pale, 0.55);
        stemCtx.lineWidth = SS * 0.38;
        stemCtx.stroke(path);
      });

      /* ----- leaves ----- */
      const leafCtx = layers.leaves.ctx;
      geom.leaves.forEach((leaf, index) => {
        const path = pathOf(leaf.outline);
        const base = map(leaf.base);
        const tip = map(leaf.tip);
        const grad = leafCtx.createLinearGradient(base.x, base.y, tip.x, tip.y);
        grad.addColorStop(0, lpal.deep);
        grad.addColorStop(0.24, lpal.dark);
        grad.addColorStop(0.65, lpal.mid);
        grad.addColorStop(0.88, lpal.bright);
        grad.addColorStop(1, lpal.hot);
        leafCtx.fillStyle = grad;
        leafCtx.fill(path);
        leafCtx.strokeStyle = rgba(lpal.deep, 0.92);
        leafCtx.lineWidth = SS * 0.82;
        leafCtx.stroke(path);

        leafCtx.save();
        leafCtx.clip(path);
        leaf.veins.forEach((vein, veinIndex) => {
          leafCtx.strokeStyle =
            veinIndex === 0 ? rgba(lpal.pale, 0.62) : rgba(lpal.dark, 0.66);
          leafCtx.lineWidth = veinIndex === 0 ? SS * 0.62 : SS * 0.44;
          leafCtx.stroke(pathOf(vein));
        });
        leafCtx.restore();

        leafCtx.strokeStyle = rgba(
          index === 0 ? lpal.hot : lpal.bright,
          0.44
        );
        leafCtx.lineWidth = SS * 0.46;
        leafCtx.stroke(path);
      });

      /* ----- flower ----- */
      const flowerCtx = layers.flower.ctx;
      geom.flower.petals.forEach((petal) => {
        const path = pathOf(petal.path);
        const base = map(petal.base);
        const tip = map(petal.tip);
        const outer = petal.layerNorm < 0.5;
        const grad = flowerCtx.createLinearGradient(
          base.x,
          base.y,
          tip.x,
          tip.y
        );
        grad.addColorStop(0, fpal.deep);
        grad.addColorStop(0.34, outer ? fpal.mid : fpal.dark);
        grad.addColorStop(0.72, outer ? fpal.bright : fpal.mid);
        grad.addColorStop(0.93, outer ? fpal.hot : fpal.bright);
        grad.addColorStop(1, outer ? fpal.pale : fpal.hot);
        flowerCtx.fillStyle = grad;
        flowerCtx.fill(path);

        flowerCtx.save();
        flowerCtx.clip(path);
        flowerCtx.strokeStyle = rgba(fpal.deep, outer ? 0.42 : 0.32);
        flowerCtx.lineWidth = SS * 0.46;
        petal.veins.forEach((vein) => {
          flowerCtx.stroke(pathOf(vein));
        });
        flowerCtx.restore();

        flowerCtx.strokeStyle = rgba(
          outer ? fpal.pale : fpal.hot,
          outer ? 0.46 : 0.6
        );
        flowerCtx.lineWidth = SS * (outer ? 0.5 : 0.62);
        flowerCtx.stroke(path);
      });

      /* centre shadow + spiral curls */
      const centerOff = map(geom.flower.center);
      const radiusOff = geom.R * layout.scale * ((sx + sy) / 2);
      const centreGrad = flowerCtx.createRadialGradient(
        centerOff.x,
        centerOff.y,
        0,
        centerOff.x,
        centerOff.y,
        Math.max(1, radiusOff * 0.66)
      );
      centreGrad.addColorStop(0, rgba(fpal.deep, 0.44));
      centreGrad.addColorStop(0.52, rgba(fpal.deep, 0.16));
      centreGrad.addColorStop(1, "rgba(0,0,0,0)");
      flowerCtx.fillStyle = centreGrad;
      flowerCtx.beginPath();
      flowerCtx.arc(centerOff.x, centerOff.y, radiusOff * 0.66, 0, TAU);
      flowerCtx.fill();

      geom.flower.curls.forEach((curl) => {
        const path = pathOf(curl.points);
        const grad = flowerCtx.createLinearGradient(
          centerOff.x,
          centerOff.y,
          map(curl.points[0]).x,
          map(curl.points[0]).y
        );
        grad.addColorStop(0, fpal.bright);
        grad.addColorStop(0.58, fpal.hot);
        grad.addColorStop(1, fpal.pale);
        flowerCtx.fillStyle = grad;
        flowerCtx.fill(path);
        flowerCtx.strokeStyle = rgba(fpal.pale, 0.46);
        flowerCtx.lineWidth = SS * 0.42;
        flowerCtx.stroke(path);
      });

      const corePath = pathOf(geom.flower.core);
      flowerCtx.fillStyle = rgba(fpal.pale, 0.92);
      flowerCtx.fill(corePath);

      /* ----- sample the three coverage layers ----- */
      const sampleLayer = (layer) => {
        const data = layer.ctx.getImageData(0, 0, ow, oh).data;
        const count = cols * rows;
        const cov = new Float32Array(count);
        const rr = new Float32Array(count);
        const gg = new Float32Array(count);
        const bb = new Float32Array(count);

        for (let y = 0; y < rows; y += 1) {
          for (let x = 0; x < cols; x += 1) {
            let aSum = 0;
            let rSum = 0;
            let gSum = 0;
            let bSum = 0;
            for (let sy2 = 0; sy2 < SS; sy2 += 1) {
              const py = y * SS + sy2;
              const rowBase = (py * ow + x * SS) * 4;
              for (let sx2 = 0; sx2 < SS; sx2 += 1) {
                const i = rowBase + sx2 * 4;
                const a = data[i + 3];
                if (a !== 0) {
                  aSum += a;
                  rSum += data[i] * a;
                  gSum += data[i + 1] * a;
                  bSum += data[i + 2] * a;
                }
              }
            }
            if (aSum > 0) {
              const idx = y * cols + x;
              cov[idx] = aSum / (SS * SS * 255);
              rr[idx] = rSum / aSum;
              gg[idx] = gSum / aSum;
              bb[idx] = bSum / aSum;
            }
          }
        }
        return { cov, rr, gg, bb };
      };

      const flowerSample = sampleLayer(layers.flower);
      const leafSample = sampleLayer(layers.leaves);
      const stemSample = sampleLayer(layers.stem);
      const count = cols * rows;
      const alphaMap = new Float32Array(count);
      const toneMap = new Float32Array(count);
      const colorR = new Float32Array(count);
      const colorG = new Float32Array(count);
      const colorB = new Float32Array(count);
      const partMap = new Uint8Array(count);
      const flowerMax = this._flowerMaxLuma;
      const leafMax = this._leafMaxLuma;

      for (let i = 0; i < count; i += 1) {
        let coverage = 0;
        let r = 0;
        let g = 0;
        let b = 0;
        let part = 0;
        let maxLuma = flowerMax;

        if (flowerSample.cov[i] > 0.055) {
          coverage = flowerSample.cov[i];
          r = flowerSample.rr[i];
          g = flowerSample.gg[i];
          b = flowerSample.bb[i];
          part = 3;
        } else if (leafSample.cov[i] > 0.055) {
          coverage = leafSample.cov[i];
          r = leafSample.rr[i];
          g = leafSample.gg[i];
          b = leafSample.bb[i];
          part = 2;
          maxLuma = leafMax;
        } else if (stemSample.cov[i] > 0.055) {
          coverage = stemSample.cov[i];
          r = stemSample.rr[i];
          g = stemSample.gg[i];
          b = stemSample.bb[i];
          part = 1;
          maxLuma = leafMax;
        }

        if (!part || coverage < 0.045) continue;

        const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        alphaMap[i] = coverage;
        toneMap[i] = clamp(lum / Math.max(0.1, maxLuma), 0, 1);
        colorR[i] = r;
        colorG[i] = g;
        colorB[i] = b;
        partMap[i] = part;
      }

      const flowerCenterS = this._worldToScreen(geom.flower.center);
      const stemTopS = this._worldToScreen(geom.stem.pointAt(0));
      const stemBottomS = this._worldToScreen(geom.stem.pointAt(1));
      const stemSpan = Math.max(1, stemBottomS.y - stemTopS.y);
      const radiusPx = Math.max(1, geom.R * layout.scale);
      const flowerTopS = flowerCenterS.y - radiusPx;
      const flowerBottomS = flowerCenterS.y + radiusPx;
      const flowerSpan = Math.max(1, flowerBottomS - flowerTopS);
      const leafScreens = geom.leaves.map((leaf, index) => ({
        index,
        base: this._worldToScreen(leaf.base),
        tip: this._worldToScreen(leaf.tip),
        lengthPx: Math.max(1, leaf.length * layout.scale),
      }));

      const field = [];
      const cellW = this.cellW;
      const cellH = this.cellH;

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const i = row * cols + col;
          const part = partMap[i];
          if (!part) continue;

          const coverage = alphaMap[i];
          const tone = toneMap[i];
          const pal = part === 3 ? fpal : lpal;

          const left = alphaMap[row * cols + Math.max(0, col - 1)];
          const right =
            alphaMap[row * cols + Math.min(cols - 1, col + 1)];
          const up = alphaMap[Math.max(0, row - 1) * cols + col];
          const down =
            alphaMap[Math.min(rows - 1, row + 1) * cols + col];

          const toneLeft = toneMap[row * cols + Math.max(0, col - 1)];
          const toneRight =
            toneMap[row * cols + Math.min(cols - 1, col + 1)];
          const toneUp = toneMap[Math.max(0, row - 1) * cols + col];
          const toneDown =
            toneMap[Math.min(rows - 1, row + 1) * cols + col];

          const gx =
            (toneRight - toneLeft) * 0.76 + (right - left) * 1.55;
          const gy =
            (toneDown - toneUp) * 0.76 + (down - up) * 1.55;
          const edgeVal = clamp(
            (Math.abs(gx) + Math.abs(gy)) * 1.08 +
              (coverage < 0.32 ? 0.27 : 0),
            0,
            1
          );

          const hash = hash3(col, row, seed);
          const fillRamp = style.fill;
          let value =
            0.3 +
            Math.pow(tone, 0.8) * 0.55 +
            Math.min(1, coverage) * 0.08 +
            (hash - 0.5) * 0.18;
          value = clamp(value, 0, 0.9999);
          let glyph =
            fillRamp[Math.floor(value * (fillRamp.length - 1))];

          const isEdge = edgeVal > 0.34 && coverage > 0.13;
          if (isEdge) {
            const ax = Math.abs(gx);
            const ay = Math.abs(gy);
            let edgeGlyph;
            if (edgeVal > 0.64 && hash > 0.3) {
              edgeGlyph = style.edgeHeavy;
            } else if (ax > ay * 1.35) {
              edgeGlyph = style.edgeV;
            } else if (ay > ax * 1.35) {
              edgeGlyph = style.edgeH;
            } else {
              edgeGlyph = gx * gy > 0 ? style.edgeA : style.edgeB;
            }
            if (hash > 0.17) glyph = edgeGlyph;
          }

          if (tone > 0.52 && hash > 0.972) {
            const accent =
              style.accents[
                Math.floor(
                  hash3(col + 11, row + 5, seed) * style.accents.length
                ) % style.accents.length
              ];
            glyph = accent;
          }

          const boost =
            0.88 + tone * 0.42 + edgeVal * 0.16 + (hash - 0.5) * 0.08;
          const cr = Math.round(clamp(colorR[i] * boost + 3, 0, 255));
          const cg = Math.round(clamp(colorG[i] * boost + 3, 0, 255));
          const cb = Math.round(clamp(colorB[i] * boost + 3, 0, 255));
          const lr = Math.round(clamp(cr + (255 - cr) * 0.52 + 20, 0, 255));
          const lg = Math.round(clamp(cg + (255 - cg) * 0.52 + 20, 0, 255));
          const lb = Math.round(clamp(cb + (255 - cb) * 0.52 + 20, 0, 255));

          const px = (col + 0.5) * cellW;
          const py = (row + 0.5) * cellH;
          let birth = 0;
          let radial = 0;
          let dirX = 0;
          let dirY = 0;
          let sway = 0;
          let depth = 0.5;

          if (part === 3) {
            const dx = px - flowerCenterS.x;
            const dy = py - flowerCenterS.y;
            const dist = Math.hypot(dx, dy) || 0.001;
            const rn = clamp(dist / radiusPx, 0, 1);
            /* Bloom from the bottom of the flower upward, one cell at a time. */
            const fromBottom = clamp(
              (flowerBottomS - py) / flowerSpan,
              0,
              1
            );
            birth =
              TIMING.flowerStart +
              fromBottom * TIMING.flowerDuration +
              hash * 0.2;
            radial = rn;
            depth = 1 - rn;
            dirX = dx / dist;
            dirY = dy / dist;
            sway = (0.22 + (1 - rn) * 0.45) * (cellW / 5);
          } else if (part === 2) {
            let best = leafScreens[0];
            let bestScore = Infinity;
            for (const leafScreen of leafScreens) {
              const d = Math.hypot(
                px - leafScreen.base.x,
                py - leafScreen.base.y
              );
              const score = d / leafScreen.lengthPx;
              if (score < bestScore) {
                bestScore = score;
                best = leafScreen;
              }
            }
            const dx = px - best.base.x;
            const dy = py - best.base.y;
            const dist = Math.hypot(dx, dy) || 0.001;
            const u = clamp(dist / best.lengthPx, 0, 1);
            birth =
              TIMING.leafStart +
              best.index * 0.07 +
              u * TIMING.leafDuration +
              hash * 0.08;
            radial = u;
            depth = 1 - u;
            dirX = dx / dist;
            dirY = dy / dist;
            sway = 0.42 * (cellW / 5);
          } else {
            const fromBottom = clamp(
              (stemBottomS.y - py) / stemSpan,
              0,
              1
            );
            birth =
              TIMING.stemStart +
              fromBottom * TIMING.stemDuration +
              hash * 0.05;
            radial = fromBottom;
            depth = fromBottom;
            dirX = 0;
            dirY = 1;
            sway = 0.12 * (cellW / 5);
          }

          field.push({
            char: glyph,
            x: px,
            y: py,
            row,
            col,
            color: `rgb(${cr},${cg},${cb})`,
            paleColor: `rgb(${lr},${lg},${lb})`,
            opacity: 0.88 + Math.min(1, coverage) * 0.12,
            glow: clamp(edgeVal * 0.7 + tone * 0.45, 0, 1),
            birth,
            part,
            radial,
            depth,
            dirX,
            dirY,
            sway,
            swaySpeed: 0.45 + hash * 0.7,
            phase: hash * TAU,
            ox: dirX * cellW * (part === 1 ? 0 : 1.35),
            oy:
              part === 1
                ? cellH * 0.75
                : dirY * cellW * 1.35,
          });
        }
      }

      this.field = field;
      this.glyphCount = field.length;

      let maxBirth = 0;
      for (const glyph of field) {
        if (glyph.birth > maxBirth) maxBirth = glyph.birth;
      }
      this.completeAt = Math.max(3, maxBirth + TIMING.fade);

      /* Derive the playback speed so the full timeline always lands on the
         requested wall-clock duration (12 seconds by default). */
      const targetDuration = Number(this.options.duration);
      if (Number.isFinite(targetDuration) && targetDuration > 0) {
        this.options.speed = clamp(this.completeAt / targetDuration, 0.1, 5);
      }

      if (this.options.debug) {
        console.info(
          "[ascii-rose]",
          `${field.length} glyphs · ${cols}×${rows} cells · ${geom.stats.petals} petals · seed ${hexSeed(seed)}`
        );
      }
    }

    /* ---------- animation loop ---------- */

    _sparkColors() {
      return this.flowerPalette.spark.concat(
        this.leafPalette.spark,
        ["#ffffff"]
      );
    }

    _onComplete() {
      if (this._completeFired) return;
      this.elapsed = this.completeAt;
      this.state = "complete";
      this._completeFired = true;
      this._bloomAt = this.visualTime;
      const center = this.layout.flowerCenter;
      this.particles.burstAt(
        center.x,
        center.y,
        128,
        this._sparkColors()
      );
      this._notify(true);
    }

    _loop(now) {
      const dt = clamp((now - this._lastFrame) / 1000, 0, 0.12);
      this._lastFrame = now;

      if (!document.hidden) {
        if (dt > 0.002) {
          const instant = 1 / dt;
          if (instant > 5 && instant < 240) {
            this.fps = this.fps * 0.92 + instant * 0.08;
          }
        }

        const animating =
          this.state === "running" || this.state === "complete";

        if (animating) {
          this.visualTime += dt;

          if (this.state === "running") {
            this.elapsed += dt * this.options.speed;
            if (this.elapsed >= this.completeAt) this._onComplete();
          }

          const reveal = clamp(
            this.visualTime / TIMING.starsDuration,
            0,
            1
          );
          this.particles.update(dt, this.visualTime, reveal);

          if (this.state === "complete") {
            this._sparkClock += dt;
            if (this._sparkClock > 0.34) {
              this._sparkClock = 0;
              const center = this.layout.flowerCenter;
              this.particles.emitBloomSpark(
                center.x,
                center.y,
                this.layout.flowerRadiusPx * 0.94,
                this._sparkColors()
              );
            }
          }

          this._render();
          this._notify(false);
        } else if (this.state === "paused" && this._pausedDirty) {
          this._render();
          this._pausedDirty = false;
        } else if (this.state === "idle" && this._idleDirty) {
          this._render();
          this._idleDirty = false;
        }
      }

      this._raf = requestAnimationFrame(this._boundLoop);
    }

    _render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.W, this.H);
      this.particles.render();
      if (this.state === "idle") return;

      if (this.state === "complete") {
        this._renderAmbient();
        return;
      }

      this._drawGlyphs(ctx, this.visualTime, false);
    }

    /* ---------- completed bloom ----------
       The finished rose is baked once into an offscreen layer. Ambient
       frames then cost a single drawImage plus a small twinkle subset,
       which keeps the idle bloom at 60 FPS instead of repainting every
       glyph of the final frame. */
    _bakeAmbient() {
      const stamp = `${Math.round(this.W)}x${Math.round(this.H)}x${this.dpr}`;
      if (this._ambientLayer && this._ambientStamp === stamp) return;

      const layer = document.createElement("canvas");
      layer.width = Math.max(1, Math.round(this.W * this.dpr));
      layer.height = Math.max(1, Math.round(this.H * this.dpr));
      const layerCtx = layer.getContext("2d");
      layerCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this._drawGlyphs(layerCtx, 0, true);

      this._ambientLayer = layer;
      this._ambientStamp = stamp;
      this._ambientGlyphs = this.field.filter((glyph, index) => index % 23 === 0);
    }

    _renderAmbient() {
      this._bakeAmbient();
      const ctx = this.ctx;
      const time = this.visualTime;

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${this.fontPx}px ${FONT_STACK}`;

      ctx.globalAlpha = 0.955 + 0.045 * Math.sin(time * 0.72);
      ctx.drawImage(this._ambientLayer, 0, 0, this.W, this.H);

      const bloomAge = this._bloomAt != null ? time - this._bloomAt : -1;
      if (bloomAge > 0 && bloomAge < 2.5) {
        for (const glyph of this.field) {
          const wave = Math.exp(
            -Math.pow((bloomAge - 0.12 - glyph.radial * 0.82) / 0.24, 2)
          );
          if (wave <= 0.075) continue;
          ctx.globalAlpha = Math.min(1, wave * 0.72);
          ctx.fillStyle = glyph.paleColor;
          ctx.fillText(glyph.char, glyph.x, glyph.y);
        }
      }

      if (this._ambientGlyphs.length) {
        for (const glyph of this._ambientGlyphs) {
          const twinkle =
            0.5 +
            0.5 *
              Math.sin(time * glyph.swaySpeed * 1.8 + glyph.phase * 1.3);
          if (twinkle < 0.8) continue;
          ctx.globalAlpha = (twinkle - 0.8) * 1.7;
          ctx.fillStyle = glyph.paleColor;
          ctx.fillText(glyph.char, glyph.x, glyph.y);
        }
      }

      ctx.restore();
    }

    _drawGlyphs(ctx, time, all) {
      if (!this.field.length) return;

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${this.fontPx}px ${FONT_STACK}`;

      const complete = this.state === "complete" && !all;

      for (const glyph of this.field) {
        let x = glyph.x;
        let y = glyph.y;
        let alpha = glyph.opacity;

        if (!all) {
          const raw = (this.elapsed - glyph.birth) / TIMING.fade;
          if (raw <= 0) continue;
          const p = clamp(raw, 0, 1);
          const eased = 1 - Math.pow(1 - p, 3);

          if (p < 1) {
            alpha *= eased;
            x += glyph.ox * (1 - eased);
            y += glyph.oy * (1 - eased);
          }

          if (complete) {
            x += Math.sin(time * glyph.swaySpeed + glyph.phase) * glyph.sway;
            y +=
              Math.cos(
                time * glyph.swaySpeed * 0.83 + glyph.phase * 1.7
              ) *
              glyph.sway *
              0.55;
            const shimmer =
              0.9 + 0.11 * Math.sin(time * 1.16 + glyph.phase * 0.7);
            alpha = Math.min(1, alpha * shimmer);
          }
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle = glyph.color;
        ctx.fillText(glyph.char, x, y);
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    /* ---------- export ---------- */

    getASCII() {
      if (!this.field.length) return "";

      const grid = Array.from({ length: this.rows }, () =>
        new Array(this.cols).fill(" ")
      );
      let minRow = this.rows;
      let maxRow = -1;
      let minCol = this.cols;
      let maxCol = -1;

      for (const glyph of this.field) {
        grid[glyph.row][glyph.col] = glyph.char;
        if (glyph.row < minRow) minRow = glyph.row;
        if (glyph.row > maxRow) maxRow = glyph.row;
        if (glyph.col < minCol) minCol = glyph.col;
        if (glyph.col > maxCol) maxCol = glyph.col;
      }

      const lines = [];
      for (let row = minRow; row <= maxRow; row += 1) {
        let line = "";
        for (let col = minCol; col <= maxCol; col += 1) {
          line += grid[row][col];
        }
        lines.push(line.replace(/ +$/, ""));
      }

      const rule = "=".repeat(Math.min(72, Math.max(28, maxCol - minCol + 1)));
      const meta = `SEED 0x${hexSeed(this.options.seed)} | ${
        this.glyphCount
      } GLYPHS | ${this.geometry.stats.petals} PETALS | ${
        this.geometry.stats.layers
      } LAYERS`;
      const header = [
        rule,
        "ASCII ROSE GENERATOR",
        "BUILT CHARACTER BY CHARACTER",
        meta,
        rule,
        "",
      ];

      return `${header.concat(lines).join("\n")}\n`;
    }

    downloadTXT() {
      const text = this.getASCII();
      const filename = `ascii-rose-${hexSeed(this.options.seed)}.txt`;
      downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), filename);
      return filename;
    }

    exportPNG() {
      return new Promise((resolve, reject) => {
        try {
          const maxDim = 3200;
          const scale = Math.min(
            3,
            maxDim / Math.max(this.W, this.H)
          );
          const poster = document.createElement("canvas");
          poster.width = Math.round(this.W * scale);
          poster.height = Math.round(this.H * scale);
          const ctx = poster.getContext("2d");
          ctx.scale(scale, scale);

          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, this.W, this.H);

          const bg = ctx.createRadialGradient(
            this.W * 0.5,
            this.H * 0.42,
            0,
            this.W * 0.5,
            this.H * 0.42,
            Math.max(this.W, this.H) * 0.65
          );
          bg.addColorStop(0, "rgba(31,7,14,0.6)");
          bg.addColorStop(0.55, "rgba(11,3,6,0.24)");
          bg.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, this.W, this.H);

          /* force a fully revealed starfield for the export */
          const oldReveal = this.particles.reveal;
          const oldTime = this.particles.time;
          this.particles.setReveal(1);
          this.particles.time = this.visualTime || 1.5;
          this.particles.render();
          ctx.drawImage(this.particles.canvas, 0, 0, this.W, this.H);
          this.particles.setReveal(oldReveal);
          this.particles.time = oldTime;
          this.particles.render();

          this._drawGlyphs(ctx, this.visualTime || 1.5, true);

          ctx.save();
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
          if ("letterSpacing" in ctx) ctx.letterSpacing = "2px";

          ctx.font = `9px ${FONT_STACK}`;
          ctx.fillStyle = "rgba(255,255,255,0.46)";
          ctx.fillText("ASCII ROSE GENERATOR", 26, 34);

          ctx.font = `8px ${FONT_STACK}`;
          ctx.fillStyle = "rgba(255,54,92,0.78)";
          ctx.fillText(`SEED 0x${hexSeed(this.options.seed)}`, 26, 48);

          ctx.textAlign = "right";
          ctx.fillStyle = "rgba(53,224,140,0.55)";
          ctx.fillText(
            `${this.glyphCount} GLYPHS / ${this.geometry.stats.petals} PETALS`,
            this.W - 26,
            34
          );

          ctx.fillStyle = "rgba(255,255,255,0.32)";
          ctx.fillText("BUILT CHARACTER BY CHARACTER", this.W - 26, this.H - 26);

          ctx.strokeStyle = "rgba(255,255,255,0.12)";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(14, 14, this.W - 28, this.H - 28);
          ctx.restore();

          const filename = `ascii-rose-${hexSeed(this.options.seed)}.png`;

          poster.toBlob((blob) => {
            if (!blob) {
              reject(new Error("PNG encoding failed"));
              return;
            }
            downloadBlob(blob, filename);
            resolve(filename);
          }, "image/png");
        } catch (error) {
          reject(error);
        }
      });
    }
  }

  global.AsciiRoseEngine = AsciiRoseEngine;
})(typeof window !== "undefined" ? window : globalThis);
