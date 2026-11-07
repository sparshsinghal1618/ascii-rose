/* ============================================================
   ASCII ROSE GENERATOR — code-display.js
   SOURCELAB reads the real .js files that run this page. When the
   page is opened over http(s) it fetches them live; when it is
   opened directly from disk it falls back to the generated local
   snapshot. No invented code, ever.
   ============================================================ */

(function (global) {
  "use strict";

  const FILES = [
    "rose-engine.js",
    "petal-generator.js",
    "particle-system.js",
    "code-display.js",
    "controls.js",
    "script.js",
  ];

  const KEYWORDS =
    "const|let|var|function|return|if|else|for|while|class|new|this|true|false|null|undefined|of|in|async|await|try|catch|finally|throw|typeof|instanceof|do|switch|case|break|continue|export|import|from|extends|super|static|get|set|delete|void|yield";

  const TOKEN_RE = new RegExp(
    [
      "(\\/\\/[^\\n]*)",
      "(\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'|`(?:\\\\.|[^`\\\\])*`)",
      `\\b(${KEYWORDS})\\b`,
      "(\\b(?:0x[0-9a-fA-F]+|\\d+(?:\\.\\d+)?)\\b)",
      "([A-Za-z_$][\\w$]*(?=\\s*\\())",
      "([A-Za-z_$][\\w$]*(?=\\s*:))",
      "([{}()\\[\\];,.])",
      "([+\\-*/%=<>!&|^~?:]+)",
    ].join("|"),
    "g"
  );

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function tokenizeSegment(segment) {
    let html = "";
    let last = 0;
    TOKEN_RE.lastIndex = 0;
    let match = TOKEN_RE.exec(segment);

    while (match) {
      html += escapeHtml(segment.slice(last, match.index));
      const text = escapeHtml(match[0]);
      let className = "tok-punctuation";

      if (match[1]) className = "tok-comment";
      else if (match[2]) className = "tok-string";
      else if (match[3]) className = "tok-keyword";
      else if (match[4]) className = "tok-number";
      else if (match[5]) className = "tok-function";
      else if (match[6]) className = "tok-property";
      else if (match[8]) className = "tok-operator";

      html += `<span class="${className}">${text}</span>`;
      last = match.index + match[0].length;
      match = TOKEN_RE.exec(segment);
    }

    html += escapeHtml(segment.slice(last));
    return html;
  }

  function highlightLine(line, state) {
    let html = "";
    let index = 0;

    if (state.inBlock) {
      const end = line.indexOf("*/");
      if (end === -1) {
        return {
          html: `<span class="tok-comment">${escapeHtml(line)}</span>`,
          state,
        };
      }
      html += `<span class="tok-comment">${escapeHtml(
        line.slice(0, end + 2)
      )}</span>`;
      index = end + 2;
      state.inBlock = false;
    }

    const rest = line.slice(index);
    const blockStart = rest.indexOf("/*");

    if (blockStart !== -1) {
      const blockEnd = rest.indexOf("*/", blockStart + 2);
      if (blockEnd === -1) {
        html += tokenizeSegment(rest.slice(0, blockStart));
        html += `<span class="tok-comment">${escapeHtml(
          rest.slice(blockStart)
        )}</span>`;
        state.inBlock = true;
        return { html, state };
      }

      html += tokenizeSegment(rest.slice(0, blockStart));
      html += `<span class="tok-comment">${escapeHtml(
        rest.slice(blockStart, blockEnd + 2)
      )}</span>`;
      html += tokenizeSegment(rest.slice(blockEnd + 2));
      return { html, state };
    }

    html += tokenizeSegment(rest);
    return { html, state };
  }

  class SourceConsole {
    constructor(elements) {
      this.tabsEl = elements.tabs;
      this.linesEl = elements.lines;
      this.scrollEl = elements.scroll;
      this.bodyEl = elements.body;
      this.modeEl = elements.mode;
      this.fileEl = elements.file;
      this.statsEl = elements.stats;
      this.autoLamp = elements.autoLamp;

      this.sources = {};
      this.current = FILES[0];
      this.lines = [];
      this.revealed = 0;
      this.timer = null;
      this.autoPaused = false;
      this.userScrollUntil = 0;
      this.bottomHold = 0;
      this.cursor = null;
      this.liveLoaded = false;

      this._tick = this._tick.bind(this);
      this._pauseAuto = this._pauseAuto.bind(this);
      this._resumeAuto = this._resumeAuto.bind(this);
      this._onWheel = this._onWheel.bind(this);

      this.scrollEl.addEventListener("mouseenter", this._pauseAuto);
      this.scrollEl.addEventListener("mouseleave", this._resumeAuto);
      this.scrollEl.addEventListener("focusin", this._pauseAuto);
      this.scrollEl.addEventListener("focusout", this._resumeAuto);
      this.scrollEl.addEventListener("wheel", this._onWheel, { passive: true });
      this.scrollEl.addEventListener("touchstart", this._onWheel, {
        passive: true,
      });
    }

    async init() {
      await this._loadSources();
      this._buildTabs();
      this.select(this.current);
    }

    async _loadSources() {
      let liveCount = 0;
      const snapshot = global.ASCII_ROSE_SOURCES || {};
      const directFile =
        global.location && global.location.protocol === "file:";

      if (directFile) {
        // Browsers block fetch() on file://. Read the generated snapshot
        // without spraying CORS errors into the console.
        FILES.forEach((file) => {
          this.sources[file] = snapshot[file] || "";
        });
      } else {
        await Promise.all(
          FILES.map(async (file) => {
            try {
              const response = await fetch(file, { cache: "no-store" });
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const text = await response.text();
              this.sources[file] = text;
              liveCount += 1;
            } catch (error) {
              if (snapshot[file]) {
                this.sources[file] = snapshot[file];
              } else {
                this.sources[file] =
                  `// Source unavailable for ${file}.\n// Serve the folder over HTTP to read it live.`;
              }
            }
          })
        );
      }

      this.liveLoaded = liveCount === FILES.length;
      if (this.modeEl) {
        this.modeEl.textContent = this.liveLoaded
          ? "LIVE HTTP FETCH"
          : "LOCAL SNAPSHOT";
      }
    }

    _buildTabs() {
      this.tabsEl.innerHTML = "";
      FILES.forEach((file, index) => {
        if (!(file in this.sources)) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "code-tab";
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", "false");
        button.dataset.file = file;
        button.innerHTML = `<span>${String(index + 1).padStart(2, "0")}</span>${file}`;
        button.addEventListener("click", () => this.select(file));
        this.tabsEl.appendChild(button);
      });
    }

    select(file) {
      if (!(file in this.sources)) return;
      this.current = file;
      this.revealed = 0;
      this.bottomHold = 0;
      this.userScrollUntil = 0;
      this.linesEl.innerHTML = "";
      this.linesEl.setAttribute("data-file", file);
      this.fileEl.textContent = file;

      Array.from(this.tabsEl.children).forEach((tab) => {
        const active = tab.dataset.file === file;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });

      const raw = this.sources[file] || "";
      const rawLines = raw.split(/\r?\n/);
      while (rawLines.length && rawLines[rawLines.length - 1] === "") {
        rawLines.pop();
      }

      const state = { inBlock: false };
      this.lines = rawLines.map((line, index) => {
        const result = highlightLine(line, state);
        return { number: index + 1, html: result.html };
      });

      if (this.statsEl) {
        this.statsEl.textContent = `${this.lines.length} LINES`;
      }

      if (!this.lines.length) {
        const placeholder = document.createElement("span");
        placeholder.className = "code-placeholder";
        placeholder.textContent = "// empty source";
        this.linesEl.appendChild(placeholder);
        return;
      }

      this.cursor = document.createElement("span");
      this.cursor.className = "code-cursor";
      this.cursor.setAttribute("aria-hidden", "true");

      this.scrollEl.scrollTop = 0;
      this._startTicker();
    }

    _startTicker() {
      if (this.timer) clearInterval(this.timer);
      this.autoPaused = false;
      this._setAutoLamp(false);
      this._tick();
      this.timer = setInterval(this._tick, 55);
    }

    _revealChunk() {
      const total = this.lines.length;
      const chunk = Math.max(1, Math.ceil(total / 90));
      const end = Math.min(total, this.revealed + chunk);
      const fragment = document.createDocumentFragment();

      for (let i = this.revealed; i < end; i += 1) {
        const entry = this.lines[i];
        const row = document.createElement("div");
        row.className = "code-row is-new";

        const number = document.createElement("span");
        number.className = "ln";
        number.textContent = String(entry.number).padStart(3, "0");

        const content = document.createElement("span");
        content.className = "lc";
        content.innerHTML = entry.html;
        content.appendChild(this.cursor);

        row.appendChild(number);
        row.appendChild(content);
        fragment.appendChild(row);
      }

      this.linesEl.appendChild(fragment);
      this.revealed = end;
    }

    _tick() {
      if (this.revealed < this.lines.length) {
        this._revealChunk();
        if (!this.autoPaused && performance.now() > this.userScrollUntil) {
          this.scrollEl.scrollTop = this.scrollEl.scrollHeight;
        }
        return;
      }

      if (this.autoPaused) return;
      if (performance.now() < this.userScrollUntil) return;

      const maxScroll =
        this.scrollEl.scrollHeight - this.scrollEl.clientHeight;
      if (maxScroll <= 0) return;

      if (this.scrollEl.scrollTop >= maxScroll - 1) {
        this.bottomHold += 1;
        if (this.bottomHold > 32) {
          this.scrollEl.scrollTop = 0;
          this.bottomHold = 0;
        }
      } else {
        this.scrollEl.scrollTop = Math.min(
          maxScroll,
          this.scrollEl.scrollTop + 0.9
        );
        this.bottomHold = 0;
      }
    }

    _pauseAuto() {
      this.autoPaused = true;
      this._setAutoLamp(true);
    }

    _resumeAuto() {
      this.autoPaused = false;
      this._setAutoLamp(false);
    }

    _onWheel() {
      this.userScrollUntil = performance.now() + 3200;
      this._pauseAuto();
      window.clearTimeout(this._userTimer);
      this._userTimer = window.setTimeout(() => {
        this.userScrollUntil = 0;
        this.autoPaused = false;
        this._setAutoLamp(false);
      }, 3200);
    }

    _setAutoLamp(paused) {
      if (this.autoLamp) {
        this.autoLamp.classList.toggle("is-paused", paused);
      }
    }
  }

  global.RoseSourceConsole = SourceConsole;
})(typeof window !== "undefined" ? window : globalThis);
