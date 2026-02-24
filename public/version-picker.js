/**
 * <cf-version-picker> — Vanilla Web Component: version badge + dropdown.
 *
 * Zero dependencies. Fetches /api/health and /versions.json on connect,
 * renders a dropdown with all deployed versions, PR previews, and links.
 * Uses light DOM — inherits page styles (DaisyUI, Tailwind, or any CSS).
 *
 * Usage:
 *   <cf-version-picker></cf-version-picker>
 *
 * Optional attributes:
 *   health-path    — health endpoint path (default: "/api/health")
 *   manifest-path  — versions.json path (default: "/versions.json")
 *   local-port     — local dev port (default: "8788")
 */
class CfVersionPicker extends HTMLElement {
  connectedCallback() {
    this._healthPath = this.getAttribute("health-path") || "/api/health";
    this._manifestPath = this.getAttribute("manifest-path") || "/versions.json";
    this._localPort = this.getAttribute("local-port") || "8788";
    this._isLocal =
      location.hostname === "localhost" || location.hostname === "127.0.0.1";
    this._data = {
      versions: [],
      previews: [],
      production: "",
      github: "",
      generated: "",
    };
    this._current = "?";
    this._loaded = false;
    this._render();
    this._fetchData();
  }

  async _fetchData() {
    try {
      const [health, manifest] = await Promise.all([
        fetch(this._healthPath)
          .then((r) => r.json())
          .catch(() => ({})),
        fetch(this._manifestPath)
          .then((r) => r.json())
          .catch(() => ({ versions: [] })),
      ]);
      this._current = health.version || "?";
      this._data = {
        versions: manifest.versions || [],
        previews: manifest.previews || [],
        production: manifest.production || "",
        github: manifest.github || "",
        generated: manifest.generated || "",
      };
      this._loaded = true;
      this._render();
    } catch {
      /* silent — badge stays "..." */
    }
  }

  _render() {
    const label = !this._loaded
      ? "..."
      : this._isLocal
        ? "local"
        : "v" + this._current;
    const title = !this._loaded
      ? ""
      : (this._isLocal ? "Local dev" : "v" + this._current) +
        " — click to switch versions";

    if (!this._loaded || this._data.versions.length === 0) {
      this.innerHTML = `
        <div class="dropdown dropdown-top dropdown-end">
          <div tabindex="0" role="button"
               class="badge badge-outline hover:badge-primary cursor-pointer font-mono text-xs"
               title="${this._esc(title)}">${this._esc(label)}</div>
        </div>`;
      return;
    }

    const v = this._data;
    const releases = v.versions.map((r) => this._renderRelease(r)).join("");

    const previews =
      v.previews.length > 0
        ? `<li class="menu-title mt-1 pt-1 border-t border-base-300">
           <span>PR Previews</span>
         </li>` + v.previews.map((p) => this._renderPreview(p)).join("")
        : "";

    const localUrl = `http://localhost:${this._localPort}`;
    const generated = v.generated ? this._relativeTime(v.generated) : "";

    this.innerHTML = `
      <div class="dropdown dropdown-top dropdown-end">
        <div tabindex="0" role="button"
             class="badge badge-outline hover:badge-primary cursor-pointer font-mono text-xs"
             title="${this._esc(title)}">${this._esc(label)}</div>
        <ul tabindex="0" class="dropdown-content menu bg-base-200 rounded-box z-50 w-72 p-2 shadow-xl text-xs mb-2">

          <li class="menu-title">
            <span>Versions</span>
          </li>
          ${releases}

          ${previews}

          <li class="menu-title mt-1 pt-1 border-t border-base-300">
            <span>Links</span>
          </li>
          <li><a href="${localUrl}" class="${this._isLocal ? "active" : ""}">
            ${this._isLocal ? this._dot("success") : this._dot("neutral")}
            Local Dev
            <span class="font-mono opacity-50">:${this._esc(this._localPort)}</span>
          </a></li>
          ${
            v.production
              ? `<li><a href="${this._esc(v.production)}" target="_blank">
            \u{1F310} Production
          </a></li>`
              : ""
          }
          ${
            v.github
              ? `<li><a href="${this._esc(v.github)}" target="_blank">
            \u{1F4E6} GitHub
          </a></li>`
              : ""
          }

          ${
            generated
              ? `<li class="disabled mt-1 pt-1 border-t border-base-300">
            <span class="opacity-40 text-[0.6rem]">Updated ${this._esc(generated)}</span>
          </li>`
              : ""
          }
        </ul>
      </div>`;
  }

  _renderRelease(r) {
    const isCurrent = r.version === this._current;
    const g = r.git;
    const date = r.date ? this._shortDate(r.date) : "";

    const healthDot =
      r.healthy === true
        ? this._dot("success")
        : r.healthy === false
          ? this._dot("error")
          : isCurrent
            ? this._dot("success")
            : this._dot("neutral");

    // Commit hash as span (not <a>) to avoid nested-anchor browser breakage
    const commitHtml = g?.commitSha
      ? `<span class="font-mono opacity-40 hover:opacity-100 cursor-pointer"
          title="${this._esc(g.commitMessage || "")}"
          onclick="event.preventDefault();event.stopPropagation();window.open('${this._esc(g.commitUrl)}','_blank')">${this._esc(g.commitSha)}</span>`
      : "";

    return `<li>
      <a href="${this._esc(r.url)}"
         target="${isCurrent ? "" : "_blank"}"
         class="${isCurrent ? "active" : ""}">
        <span class="flex items-center justify-between w-full gap-2">
          <span class="flex items-center gap-1.5 min-w-0">
            ${healthDot}
            <span>v${this._esc(r.version)}</span>
            ${isCurrent ? '<span class="badge badge-xs badge-success">live</span>' : ""}
          </span>
          <span class="flex items-center gap-2 shrink-0">
            ${commitHtml}
            <span class="opacity-30">${this._esc(date)}</span>
          </span>
        </span>
      </a>
    </li>`;
  }

  _renderPreview(p) {
    const healthDot =
      p.healthy === true
        ? this._dot("success")
        : p.healthy === false
          ? this._dot("error")
          : this._dot("warning");
    const date = p.date ? this._shortDate(p.date) : "";

    const prNum = p.tag?.replace("pr-", "") || "";
    const prLink =
      this._data.github && prNum
        ? `<span class="opacity-40 hover:opacity-100 cursor-pointer"
          title="View PR on GitHub"
          onclick="event.preventDefault();event.stopPropagation();window.open('${this._esc(this._data.github + "/pull/" + prNum)}','_blank')">#${this._esc(prNum)}</span>`
        : "";

    return `<li>
      <a href="${this._esc(p.url)}" target="_blank">
        <span class="flex items-center justify-between w-full gap-2">
          <span class="flex items-center gap-1.5 min-w-0">
            ${healthDot}
            <span>${this._esc(p.label)}</span>
          </span>
          <span class="flex items-center gap-2 shrink-0">
            ${prLink}
            <span class="opacity-30">${this._esc(date)}</span>
          </span>
        </span>
      </a>
    </li>`;
  }

  /** Colored status dot */
  _dot(color) {
    const colors = {
      success: "bg-success",
      error: "bg-error",
      warning: "bg-warning",
      neutral: "bg-base-content opacity-20",
    };
    return `<span class="inline-block w-1.5 h-1.5 rounded-full shrink-0 ${colors[color] || colors.neutral}"></span>`;
  }

  /** Short date: "Feb 24" or "Feb 24, 2025" if different year */
  _shortDate(iso) {
    try {
      const d = new Date(iso);
      const now = new Date();
      const opts = { month: "short", day: "numeric" };
      if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
      return d.toLocaleDateString("en-US", opts);
    } catch {
      return "";
    }
  }

  /** Relative time: "2m ago", "3h ago", "yesterday" */
  _relativeTime(iso) {
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "just now";
      if (mins < 60) return mins + "m ago";
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return hrs + "h ago";
      const days = Math.floor(hrs / 24);
      if (days === 1) return "yesterday";
      return days + "d ago";
    } catch {
      return "";
    }
  }

  /** Escape HTML to prevent XSS from manifest data */
  _esc(s) {
    if (!s) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

customElements.define("cf-version-picker", CfVersionPicker);
