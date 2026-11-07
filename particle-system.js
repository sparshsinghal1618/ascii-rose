/* ============================================================
   ASCII ROSE GENERATOR — particle-system.js
   A quiet starfield with twinkle, drift, dust, rare shooting
   stars and the celebratory bloom burst. Drawn behind the rose.
   ============================================================ */

(function (global) {
  "use strict";

  const STAR_TINTS = [
    { color: "#ffffff", sprite: 0 },
    { color: "#ffdce5", sprite: 1 },
    { color: "#cfe1ff", sprite: 2 },
    { color: "#ffe9c2", sprite: 3 },
    { color: "#ffb8c8", sprite: 1 },
  ];

  const DUST_TINTS = ["#ffcfda", "#c9ffe4", "#ffffff", "#ff8fa8"];

  function clamp(v, a, b) {
    return Math.min(b, Math.max(a, v));
  }

  function rand(a, b) {
    return a + (b - a) * Math.random();
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length) % list.length];
  }

  class RoseParticleField {
    constructor(canvas, options) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: true });
      this.opts = options || {};
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.density = 1;
      this.stars = [];
      this.dust = [];
      this.coloredDust = [];
      this.burst = [];
      this.shooting = null;
      this.nextShooting = rand(7, 15);
      this.reveal = 0;
      this.time = 0;
      this.glowSprites = [];
      this._lastClear = false;
      this._buildSprites();
    }

    _buildSprites() {
      const tints = ["#ffffff", "#ffdce5", "#cfe1ff", "#ffe9c2"];
      this.glowSprites = tints.map((color) => {
        const c = document.createElement("canvas");
        c.width = 48;
        c.height = 48;
        const ctx = c.getContext("2d");
        const g = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
        const rgb = this._hexToRgb(color);
        g.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0.85)`);
        g.addColorStop(0.14, `rgba(${rgb.r},${rgb.g},${rgb.b},0.34)`);
        g.addColorStop(0.42, `rgba(${rgb.r},${rgb.g},${rgb.b},0.075)`);
        g.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 48, 48);
        return c;
      });
    }

    _hexToRgb(hex) {
      const value = hex.replace("#", "");
      const full =
        value.length === 3
          ? value
              .split("")
              .map((c) => c + c)
              .join("")
          : value;
      return {
        r: parseInt(full.slice(0, 2), 16),
        g: parseInt(full.slice(2, 4), 16),
        b: parseInt(full.slice(4, 6), 16),
      };
    }

    resize(width, height, dpr) {
      this.width = Math.max(1, width);
      this.height = Math.max(1, height);
      this.dpr = clamp(dpr || 1, 1, 2.5);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this._rebuild();
      this._lastClear = false;
    }

    setDensity(density) {
      this.density = clamp(density || 1, 0.25, 2.5);
      if (this.width && this.height) this._rebuild();
    }

    _rebuild() {
      const area = this.width * this.height;
      const count = clamp(
        Math.round((area / 1450) * this.density),
        80,
        680
      );
      this.stars = [];

      for (let i = 0; i < count; i += 1) {
        const tint = pick(STAR_TINTS);
        const size = rand(0.45, 1.65);
        this.stars.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          size,
          baseAlpha: rand(0.16, 0.9),
          twinkle: rand(0.22, 2.4),
          phase: rand(0, Math.PI * 2),
          vx: rand(-1.9, 1.9),
          vy: rand(-1.1, 2.2),
          glyph: Math.random() < 0.17 ? pick([".", "+", "*", "`", "'"]) : null,
          tint: tint.color,
          sprite: tint.sprite,
          glow: size > 0.9 && Math.random() < 0.24,
        });
      }

      const dustCount = clamp(Math.round((area / 19000) * this.density), 24, 100);
      this.dust = [];
      for (let i = 0; i < dustCount; i += 1) {
        this.dust.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          size: rand(0.45, 1.2),
          alpha: rand(0.04, 0.23),
          vx: rand(-2.4, 2.4),
          vy: rand(-0.6, 2.5),
          phase: rand(0, Math.PI * 2),
          twinkle: rand(0.2, 1.1),
        });
      }

      const moteCount = clamp(Math.round((area / 30000) * this.density), 8, 42);
      this.coloredDust = [];
      for (let i = 0; i < moteCount; i += 1) {
        this.coloredDust.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          size: rand(0.6, 1.4),
          alpha: rand(0.05, 0.2),
          vx: rand(-2.2, 2.2),
          vy: rand(-4, 1.2),
          phase: rand(0, Math.PI * 2),
          tint: pick(DUST_TINTS),
        });
      }

      this._lastClear = false;
    }

    reset() {
      this.reveal = 0;
      this.burst = [];
      this.shooting = null;
      this.nextShooting = rand(7, 15);
      this.ctx.clearRect(0, 0, this.width, this.height);
      this._lastClear = true;
    }

    setReveal(value) {
      this.reveal = clamp(value, 0, 1);
    }

    burstAt(x, y, count, colors) {
      const palette = colors && colors.length ? colors : ["#ff365c", "#ff8fa8", "#ffffff", "#35e08c"];
      const amount = Math.min(count || 90, 160);
      for (let i = 0; i < amount; i += 1) {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(15, 118);
        const life = rand(1.4, 3.2);
        this.burst.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - rand(4, 28),
          gravity: rand(9, 30),
          life: 0,
          maxLife: life,
          glyph: pick([".", "+", "*", "'", "`", "·", "@", "x"]),
          color: pick(palette),
          size: rand(7, 13),
          drag: rand(0.8, 1.8),
        });
      }
      if (this.burst.length > 320) {
        this.burst.splice(0, this.burst.length - 320);
      }
    }

    emitBloomSpark(x, y, radius, colors) {
      const angle = rand(0, Math.PI * 2);
      const r = radius * rand(0.25, 1.05);
      const life = rand(1.4, 3.6);
      this.burst.push({
        x: x + Math.cos(angle) * r,
        y: y + Math.sin(angle) * r * 0.9,
        vx: Math.cos(angle) * rand(2, 18),
        vy: -rand(3, 16),
        gravity: rand(-3, 3),
        life: 0,
        maxLife: life,
        glyph: pick([".", ".", "+", "*", "'", "·"]),
        color: pick(colors),
        size: rand(6, 11),
        drag: rand(0.15, 0.6),
      });
      if (this.burst.length > 260) {
        this.burst.splice(0, this.burst.length - 260);
      }
    }

    update(dt, time, reveal) {
      this.time = time;
      this.setReveal(reveal);

      if (this.reveal <= 0 && this.burst.length === 0 && !this._lastClear) {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this._lastClear = true;
        return;
      }

      this._lastClear = false;
      const speed = clamp(dt, 0, 0.06);

      for (const star of this.stars) {
        star.x += star.vx * speed;
        star.y += star.vy * speed;
        if (star.x < -4) star.x = this.width + 4;
        if (star.x > this.width + 4) star.x = -4;
        if (star.y < -4) star.y = this.height + 4;
        if (star.y > this.height + 4) star.y = -4;
      }

      for (const mote of this.dust) {
        mote.x += mote.vx * speed;
        mote.y += mote.vy * speed;
        if (mote.x < -3) mote.x = this.width + 3;
        if (mote.x > this.width + 3) mote.x = -3;
        if (mote.y < -3) mote.y = this.height + 3;
        if (mote.y > this.height + 3) mote.y = -3;
      }

      for (const mote of this.coloredDust) {
        mote.x += mote.vx * speed;
        mote.y += mote.vy * speed;
        if (mote.x < -3) mote.x = this.width + 3;
        if (mote.x > this.width + 3) mote.x = -3;
        if (mote.y < -3) mote.y = this.height + 3;
        if (mote.y > this.height + 3) mote.y = -3;
      }

      for (let i = this.burst.length - 1; i >= 0; i -= 1) {
        const p = this.burst[i];
        p.life += speed;
        if (p.life >= p.maxLife) {
          this.burst.splice(i, 1);
          continue;
        }
        const drag = Math.max(0, 1 - p.drag * speed);
        p.vx *= drag;
        p.vy = p.vy * drag + p.gravity * speed;
        p.x += p.vx * speed;
        p.y += p.vy * speed;
      }

      if (this.reveal > 0.55) {
        if (!this.shooting && time > this.nextShooting) {
          this.shooting = {
            x: rand(this.width * 0.16, this.width * 0.94),
            y: rand(this.height * 0.06, this.height * 0.4),
            vx: -rand(130, 250),
            vy: rand(42, 92),
            life: 0,
            maxLife: rand(0.55, 0.95),
          };
        }
      }

      if (this.shooting) {
        this.shooting.life += speed;
        this.shooting.x += this.shooting.vx * speed;
        this.shooting.y += this.shooting.vy * speed;
        if (this.shooting.life >= this.shooting.maxLife) {
          this.shooting = null;
          this.nextShooting = time + rand(8, 19);
        }
      }
    }

    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);

      if (this.reveal <= 0 && this.burst.length === 0) {
        this._lastClear = true;
        return;
      }

      const reveal = this.reveal;
      const time = this.time;

      /* faint coloured dust — depth behind the stars */
      for (const mote of this.coloredDust) {
        const twinkle = 0.55 + 0.45 * Math.sin(time * 0.7 + mote.phase);
        ctx.globalAlpha = mote.alpha * reveal * twinkle;
        ctx.fillStyle = mote.tint;
        ctx.fillRect(mote.x, mote.y, mote.size, mote.size);
      }

      /* tiny drifting dust */
      for (const mote of this.dust) {
        const twinkle = 0.6 + 0.4 * Math.sin(time * mote.twinkle + mote.phase);
        ctx.globalAlpha = mote.alpha * reveal * twinkle;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(mote.x, mote.y, mote.size, mote.size);
      }

      /* stars */
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (const star of this.stars) {
        const twinkle =
          0.5 +
          0.5 * Math.sin(time * star.twinkle + star.phase) * (0.7 + star.baseAlpha * 0.3);
        const alpha = star.baseAlpha * reveal * twinkle;

        if (alpha <= 0.01) continue;

        if (star.glow) {
          ctx.globalAlpha = alpha * 0.36;
          const sprite = this.glowSprites[star.sprite];
          const glowSize = 6 + star.size * 5;
          ctx.drawImage(
            sprite,
            star.x - glowSize / 2,
            star.y - glowSize / 2,
            glowSize,
            glowSize
          );
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle = star.tint;

        if (star.glyph) {
          ctx.font = `${Math.round(7 + star.size * 3)}px "Cascadia Mono", Consolas, monospace`;
          ctx.fillText(star.glyph, star.x, star.y);
        } else {
          ctx.fillRect(star.x, star.y, star.size, star.size);
        }
      }

      /* rare shooting star */
      if (this.shooting) {
        const s = this.shooting;
        const fade = Math.sin((s.life / s.maxLife) * Math.PI);
        const tailX = s.x - s.vx * 0.11;
        const tailY = s.y - s.vy * 0.11;
        const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255,255,255,${0.75 * fade * reveal})`);
        grad.addColorStop(0.4, `rgba(255,220,230,${0.3 * fade * reveal})`);
        grad.addColorStop(1, "rgba(255,120,150,0)");
        ctx.globalAlpha = 1;
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
      }

      /* bloom sparks */
      for (const p of this.burst) {
        const lifeRatio = p.life / p.maxLife;
        const alpha = Math.sin(Math.min(1, lifeRatio) * Math.PI) * 0.9;
        ctx.globalAlpha = alpha * reveal;
        ctx.fillStyle = p.color;
        ctx.font = `${p.size}px "Cascadia Mono", Consolas, monospace`;
        ctx.fillText(p.glyph, p.x, p.y);
      }

      ctx.globalAlpha = 1;
    }
  }

  global.RoseParticleField = RoseParticleField;
})(typeof window !== "undefined" ? window : globalThis);
