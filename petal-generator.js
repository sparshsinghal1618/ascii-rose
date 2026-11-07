/* ============================================================
   ASCII ROSE GENERATOR — petal-generator.js
   Procedural botany. No images. No pretrained assets.

   The flower is a stack of overlapping parametric petals. Each
   petal is built from a ruffled width profile, a curved spine and
   a rounded tip. Curls close the spiral at the centre. The stem is
   a tapered Bézier ribbon and the two leaves are serrated blades
   with real veins.

   Everything below is deterministic for a given seed, so a rose
   can be rebuilt, exported and reproduced exactly.
   ============================================================ */

(function (global) {
  "use strict";

  const TAU = Math.PI * 2;

  /* ---------- deterministic randomness ---------- */

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRandom(seed) {
    const next = mulberry32(seed);
    return {
      next,
      range(min, max) {
        return min + (max - min) * next();
      },
      int(min, max) {
        return Math.floor(min + (max - min + 1) * next());
      },
      pick(list) {
        return list[Math.floor(next() * list.length) % list.length];
      },
    };
  }

  /* ---------- small maths helpers ---------- */

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0 || 1), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  function rotate(local, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: local.x * cos - local.y * sin,
      y: local.x * sin + local.y * cos,
    };
  }

  function transformPoints(points, base, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return points.map((p) => ({
      x: base.x + p.x * cos - p.y * sin,
      y: base.y + p.x * sin + p.y * cos,
    }));
  }

  function centroid(points) {
    let x = 0;
    let y = 0;
    for (const p of points) {
      x += p.x;
      y += p.y;
    }
    return { x: x / points.length, y: y / points.length };
  }

  /* ============================================================
     PETAL
     ============================================================ */

  function buildPetal(options) {
    const {
      index,
      layer,
      layers,
      layerNorm,
      count,
      angle,
      radius,
      R,
      rng,
    } = options;

    const baseRadius = R * rng.range(0.015, 0.075) * (1 - layerNorm * 0.35);
    const length = Math.max(R * 0.08, radius - baseRadius);
    const widthFactor = rng.range(0.78, 0.98) - layerNorm * 0.045;
    const halfWidth = (length * widthFactor) / 2;
    const lean = rng.range(-0.16, 0.16) * length;
    const ruffleAmp = rng.range(0.035, 0.115) * (1 - layerNorm * 0.25);
    const ruffleFreq = rng.range(6.2, 10.8);
    const phase = rng.range(0, TAU);
    const asymmetry = rng.range(-0.075, 0.075);
    const tipHeight = halfWidth * mix(0.17, 0.055, layerNorm) + length * 0.025;

    const samples = 22;
    const sideEnd = 0.94;

    function spineX(s) {
      return (
        lean * Math.pow(s, 1.72) +
        Math.sin(s * Math.PI * 1.35 + phase * 0.35) * length * 0.028 * s
      );
    }

    function widthAt(s) {
      const profile = Math.pow(
        Math.sin(Math.PI * Math.pow(clamp(s, 0, 1), 0.68)),
        0.55
      );
      const ruffle =
        1 +
        ruffleAmp *
          Math.sin(s * ruffleFreq * Math.PI + phase) *
          smoothstep(0.2, 1, s);
      return Math.max(0, halfWidth * profile * ruffle);
    }

    const left = [];
    const right = [];

    for (let i = 0; i <= samples; i += 1) {
      const s = (i / samples) * sideEnd;
      const width = widthAt(s);
      const cx = spineX(s);
      const y = baseRadius + length * s;
      left.push({ x: cx - width * (1 - asymmetry), y });
      right.push({ x: cx + width * (1 + asymmetry), y });
    }

    const tipS = sideEnd;
    const tipCx = spineX(tipS);
    const tipY = baseRadius + length * tipS;
    const tipWidth = widthAt(tipS);
    const arc = [];

    for (let i = 1; i < 7; i += 1) {
      const a = Math.PI * (1 - i / 7);
      arc.push({
        x: tipCx + Math.cos(a) * tipWidth,
        y: tipY + Math.sin(a) * tipHeight,
      });
    }

    const localPath = left.concat(arc, right.slice().reverse());
    const base = {
      x: Math.cos(angle) * baseRadius,
      y: Math.sin(angle) * baseRadius,
    };
    const path = transformPoints(localPath, base, angle);
    const tipLocal = {
      x: spineX(0.995),
      y: baseRadius + length * 0.995,
    };
    const tip = rotate(tipLocal, angle);
    tip.x += base.x;
    tip.y += base.y;

    /* Petal veins are subtle, curved ribs following the local spine. */
    const veins = [];
    const veinCount = rng.int(2, 3);

    for (let v = 0; v < veinCount; v += 1) {
      const offset =
        (v - (veinCount - 1) / 2) * halfWidth * rng.range(0.35, 0.55);
      const startS = rng.range(0.04, 0.14);
      const endS = rng.range(0.68, 0.88);
      const local = [];

      for (let i = 0; i <= 7; i += 1) {
        const s = mix(startS, endS, i / 7);
        const width = widthAt(s);
        const lateral =
          offset * smoothstep(0.05, 0.85, s) +
          Math.sin(s * 8.5 + phase + v) * width * 0.06;
        local.push({
          x:
            spineX(s) +
            clamp(lateral, -width * 0.72, width * 0.72),
          y: baseRadius + length * s,
        });
      }

      veins.push(transformPoints(local, base, angle));
    }

    return {
      kind: "petal",
      index,
      layer,
      layers,
      layerNorm,
      count,
      angle,
      radius,
      length,
      halfWidth,
      widthFactor,
      base,
      tip,
      path,
      veins,
      shade: clamp(0.95 - layerNorm * 0.32 + rng.range(-0.08, 0.08), 0.25, 1),
      ruffle: ruffleAmp,
    };
  }

  /* ============================================================
     CENTRE CURLS
     ============================================================ */

  function buildCurl({ index, R, rng }) {
    const start = index * 2.399963 + rng.range(-0.24, 0.24);
    const span = rng.range(Math.PI * 0.72, Math.PI * 1.08);
    const outer = R * (0.066 + index * 0.024 + rng.range(-0.008, 0.008));
    const inner = outer * rng.range(0.42, 0.62);
    const drift = R * rng.range(0.005, 0.02);
    const points = [];
    const steps = 15;

    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const a = start + span * t;
      const rad = outer * (1 - 0.10 * t);
      points.push({
        x: Math.cos(a) * rad + Math.cos(start) * drift,
        y: Math.sin(a) * rad + Math.sin(start) * drift,
      });
    }

    for (let i = steps; i >= 0; i -= 1) {
      const t = i / steps;
      const a = start + span * t;
      const rad = inner * (1 - 0.18 * t);
      points.push({
        x: Math.cos(a) * rad + Math.cos(start) * drift * 0.4,
        y: Math.sin(a) * rad + Math.sin(start) * drift * 0.4,
      });
    }

    return {
      kind: "curl",
      index,
      start,
      span,
      outer,
      inner,
      points,
      shade: clamp(0.9 - index * 0.055, 0.52, 1),
    };
  }

  /* ============================================================
     STEM
     ============================================================ */

  function buildStem({ R, rng }) {
    const topY = R * 0.36;
    const bottomY = R * 1.95;
    const p0 = { x: R * 0.02, y: topY };
    const c1 = { x: R * rng.range(0.13, 0.2), y: topY + R * 0.3 };
    const c2 = { x: -R * rng.range(0.08, 0.15), y: bottomY - R * 0.34 };
    const p3 = { x: -R * rng.range(0.015, 0.06), y: bottomY };
    const segments = 36;
    const center = [];

    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const u = 1 - t;
      center.push({
        x:
          u * u * u * p0.x +
          3 * u * u * t * c1.x +
          3 * u * t * t * c2.x +
          t * t * t * p3.x,
        y:
          u * u * u * p0.y +
          3 * u * u * t * c1.y +
          3 * u * t * t * c2.y +
          t * t * t * p3.y,
      });
    }

    function halfWidthAt(t) {
      return R * (0.033 - 0.011 * t) * (1 + 0.08 * Math.sin(t * 10.5 + 0.7));
    }

    const left = [];
    const right = [];

    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const prev = center[Math.max(0, i - 1)];
      const next = center[Math.min(segments, i + 1)];
      const tx = next.x - prev.x;
      const ty = next.y - prev.y;
      const len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len;
      const ny = tx / len;
      const width = halfWidthAt(t);
      left.push({ x: center[i].x + nx * width, y: center[i].y + ny * width });
      right.push({ x: center[i].x - nx * width, y: center[i].y - ny * width });
    }

    const outline = left.concat(right.slice().reverse());
    const highlight = center.map((p, i) => {
      const t = i / segments;
      const prev = center[Math.max(0, i - 1)];
      const next = center[Math.min(segments, i + 1)];
      const tx = next.x - prev.x;
      const ty = next.y - prev.y;
      const len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len;
      const ny = tx / len;
      return {
        x: p.x + nx * halfWidthAt(t) * 0.36,
        y: p.y + ny * halfWidthAt(t) * 0.36,
      };
    });

    function pointAt(t) {
      const raw = clamp(t, 0, 1) * segments;
      const i = Math.floor(raw);
      const f = raw - i;
      const a = center[Math.min(segments, i)];
      const b = center[Math.min(segments, i + 1)];
      return { x: mix(a.x, b.x, f), y: mix(a.y, b.y, f) };
    }

    /* Thorns: three small alternate triangles. */
    const thorns = [];
    const thornTs = [0.36, 0.58, 0.79];

    thornTs.forEach((t, i) => {
      const p = pointAt(t);
      const p2 = pointAt(Math.min(1, t + 0.01));
      const tx = p2.x - p.x;
      const ty = p2.y - p.y;
      const len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len;
      const ny = tx / len;
      const side = i % 2 === 0 ? 1 : -1;
      const w = halfWidthAt(t);
      thorns.push([
        { x: p.x + nx * w * side, y: p.y + ny * w * side },
        {
          x: p.x + nx * w * side * 0.2 + (tx / len) * w * 0.38,
          y: p.y + ny * w * side * 0.2 + (ty / len) * w * 0.38,
        },
        {
          x: p.x + nx * w * side * 2.6,
          y: p.y + ny * w * side * 2.6,
        },
        {
          x: p.x + nx * w * side * 0.2 - (tx / len) * w * 0.32,
          y: p.y + ny * w * side * 0.2 - (ty / len) * w * 0.32,
        },
      ]);
    });

    /* Fine cross-lines read as nodes / leaf scars in ASCII. */
    const nodes = [];
    [0.18, 0.28, 0.44, 0.63, 0.86].forEach((t) => {
      const p = pointAt(t);
      const p2 = pointAt(Math.min(1, t + 0.012));
      const tx = p2.x - p.x;
      const ty = p2.y - p.y;
      const len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len;
      const ny = tx / len;
      const w = halfWidthAt(t);
      nodes.push([
        { x: p.x + nx * w * 0.7, y: p.y + ny * w * 0.7 },
        { x: p.x - nx * w * 0.7, y: p.y - ny * w * 0.7 },
      ]);
    });

    return {
      kind: "stem",
      center,
      outline,
      highlight,
      thorns,
      nodes,
      topY,
      bottomY,
      tTop: 0,
      tBottom: 1,
      pointAt,
      halfWidthAt,
    };
  }

  /* ============================================================
     LEAF
     ============================================================ */

  function buildLeaf({ R, stem, attachT, side, rng }) {
    const stemPoint = stem.pointAt(attachT);
    const next = stem.pointAt(Math.min(1, attachT + 0.01));
    const tx = next.x - stemPoint.x;
    const ty = next.y - stemPoint.y;
    const tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl;
    const ny = tx / tl;
    const angle =
      side === "right"
        ? rng.range(-0.46, -0.2)
        : Math.PI + rng.range(0.18, 0.46);
    const base = {
      x: stemPoint.x + nx * stem.halfWidthAt(attachT) * 0.55 + Math.cos(angle) * R * 0.018,
      y: stemPoint.y + ny * stem.halfWidthAt(attachT) * 0.55 + Math.sin(angle) * R * 0.018,
    };
    const length = R * rng.range(0.82, 0.97);
    const halfWidth = R * rng.range(0.19, 0.235);
    const bend = R * rng.range(0.035, 0.085) * (side === "right" ? 1 : -1);
    const phase = rng.range(0, TAU);
    const serration = rng.range(0.035, 0.065);

    function spine(u) {
      return {
        x: length * u,
        y:
          bend * Math.sin(Math.PI * Math.pow(u, 0.9)) +
          Math.sin(phase) * length * 0.018 * u * u,
      };
    }

    function widthAt(u) {
      const profile = Math.pow(
        Math.sin(Math.PI * Math.pow(clamp(u, 0, 1), 0.68)),
        0.72
      );
      const teeth =
        1 +
        serration *
          Math.sin(u * 30 * Math.PI + phase) *
          smoothstep(0.04, 0.35, u);
      return halfWidth * profile * teeth;
    }

    const upper = [];
    const lower = [];
    const samples = 34;

    for (let i = 0; i <= samples; i += 1) {
      const u = i / samples;
      const p = spine(u);
      const w = widthAt(u);
      const prev = spine(Math.max(0, u - 0.01));
      const nxt = spine(Math.min(1, u + 0.01));
      const dx = nxt.x - prev.x;
      const dy = nxt.y - prev.y;
      const dl = Math.hypot(dx, dy) || 1;
      const px = -dy / dl;
      const py = dx / dl;
      upper.push({ x: p.x + px * w, y: p.y + py * w });
      lower.push({ x: p.x - px * w, y: p.y - py * w });
    }

    const localOutline = upper.concat(lower.slice().reverse());
    const outline = transformPoints(localOutline, base, angle);
    const tipLocal = spine(1);
    const tip = rotate(tipLocal, angle);
    tip.x += base.x;
    tip.y += base.y;

    const localSpine = [];
    for (let i = 0; i <= 24; i += 1) {
      const u = (i / 24) * 0.985;
      localSpine.push(spine(u));
    }

    const veins = [transformPoints(localSpine, base, angle)];
    const ribStops = [0.16, 0.28, 0.4, 0.52, 0.64, 0.76];

    ribStops.forEach((u) => {
      ["upper", "lower"].forEach((edgeSide) => {
        const start = spine(u);
        const endU = Math.min(0.97, u + 0.15);
        const end = spine(endU);
        const endW = widthAt(endU) * 0.76 * (edgeSide === "upper" ? 1 : -1);
        const prev = spine(Math.max(0, endU - 0.01));
        const dx = end.x - prev.x;
        const dy = end.y - prev.y;
        const dl = Math.hypot(dx, dy) || 1;
        const px = -dy / dl;
        const py = dx / dl;
        const local = [];
        for (let i = 0; i <= 6; i += 1) {
          const t = i / 6;
          const s = mix(u, endU, t);
          const edge = mix(0, endW, smoothstep(0, 1, t));
          const p = spine(s);
          const wobble = Math.sin(t * Math.PI) * widthAt(s) * 0.15 * (edgeSide === "upper" ? 1 : -1);
          local.push({
            x: p.x + px * (edge + wobble),
            y: p.y + py * (edge + wobble),
          });
        }
        veins.push(transformPoints(local, base, angle));
      });
    });

    return {
      kind: "leaf",
      side,
      attachT,
      base,
      tip,
      angle,
      length,
      halfWidth,
      outline,
      spine: transformPoints(localSpine, base, angle),
      veins,
      shade: rng.range(0.75, 1),
    };
  }

  /* ============================================================
     BOUNDS
     ============================================================ */

  function computeBounds(petals, curls, stem, leaves) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    function eat(points) {
      for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }

    petals.forEach((p) => eat(p.path));
    curls.forEach((c) => eat(c.points));
    eat(stem.outline);
    leaves.forEach((leaf) => eat(leaf.outline));

    const pad = 0.018;
    return {
      minX: minX - pad,
      minY: minY - pad,
      maxX: maxX + pad,
      maxY: maxY + pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    };
  }

  /* ============================================================
     MAIN GENERATOR
     ============================================================ */

  function generate(options) {
    const opts = options || {};
    const seed = (opts.seed >>> 0) || 0x1a2b3c4d;
    const complexity = clamp(opts.complexity == null ? 1 : opts.complexity, 0, 1);
    const rng = makeRandom(seed);
    const R = 0.32;

    const layers = 4 + Math.round(complexity * 3);
    const outerCount =
      8 + Math.round(complexity * 2) + (rng.next() > 0.62 ? 1 : 0);

    const petals = [];
    const layerRadii = [];

    for (let layerIndex = 0; layerIndex < layers; layerIndex += 1) {
      const u = layers === 1 ? 0 : layerIndex / (layers - 1);
      const layerRadius =
        R * (1 - 0.71 * Math.pow(u, 0.94)) * rng.range(0.97, 1.025);
      const count = Math.max(
        4,
        Math.round(outerCount * (1 - u * 0.47) + rng.range(-0.35, 0.35))
      );
      const offset =
        layerIndex * 0.615 + rng.range(-0.12, 0.12) + (layerIndex % 2) * 0.16;

      layerRadii.push(layerRadius);

      for (let i = 0; i < count; i += 1) {
        const angle =
          offset + (i / count) * TAU + rng.range(-0.075, 0.075);
        const radius =
          layerRadius * rng.range(0.955, 1.045) * (1 - u * 0.012);
        petals.push(
          buildPetal({
            index: i,
            layer: layerIndex,
            layers,
            layerNorm: u,
            count,
            angle,
            radius,
            R,
            rng,
          })
        );
      }
    }

    const curlCount = 4 + Math.round(complexity * 2);
    const curls = [];

    for (let i = 0; i < curlCount; i += 1) {
      curls.push(buildCurl({ index: i, R, rng }));
    }

    const core = [];
    const coreRadius = R * 0.033;
    for (let i = 0; i < 14; i += 1) {
      const a = (i / 14) * TAU;
      const r = coreRadius * (0.75 + rng.next() * 0.5);
      core.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }

    const stem = buildStem({ R, rng });
    const leaves = [
      buildLeaf({ R, stem, attachT: 0.475 + rng.range(-0.03, 0.03), side: "right", rng }),
      buildLeaf({ R, stem, attachT: 0.72 + rng.range(-0.03, 0.03), side: "left", rng }),
    ];

    const bounds = computeBounds(petals, curls, stem, leaves);

    /* centroid of the flower is useful for camera framing */
    const flowerCenter = centroid(
      petals
        .filter((p) => p.layer === 0)
        .reduce((acc, p) => acc.concat(p.path), [])
    );

    return {
      seed,
      R,
      complexity,
      layers,
      outerCount,
      layerRadii,
      flower: {
        center: flowerCenter,
        R,
        petals,
        curls,
        core,
      },
      stem,
      leaves,
      bounds,
      stats: {
        petals: petals.length,
        layers,
        curls: curls.length,
        leaves: leaves.length,
        vertices: petals.reduce((sum, p) => sum + p.path.length, 0),
      },
    };
  }

  global.RosePetalGenerator = {
    generate,
    mulberry32,
    makeRandom,
    TAU,
  };
})(typeof window !== "undefined" ? window : globalThis);
