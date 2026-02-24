/**
 * <cf-version-picker> — Vanilla Web Component: version badge + dropdown.
 *
 * Zero dependencies. Fetches /api/health and /versions.json on connect,
 * renders a dropdown with all deployed versions and links.
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
    this._healthPath = this.getAttribute('health-path') || '/api/health';
    this._manifestPath = this.getAttribute('manifest-path') || '/versions.json';
    this._localPort = this.getAttribute('local-port') || '8788';
    this._isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    this._data = { versions: [], previews: [], production: '', github: '' };
    this._current = '?';
    this._loaded = false;
    this._render();
    this._fetchData();
  }

  async _fetchData() {
    try {
      const [health, manifest] = await Promise.all([
        fetch(this._healthPath).then(r => r.json()).catch(() => ({})),
        fetch(this._manifestPath).then(r => r.json()).catch(() => ({ versions: [] })),
      ]);
      this._current = health.version || '?';
      this._data = {
        versions: manifest.versions || [],
        previews: manifest.previews || [],
        production: manifest.production || '',
        github: manifest.github || '',
      };
      this._loaded = true;
      this._render();
    } catch { /* silent — badge stays "..." */ }
  }

  _render() {
    const label = !this._loaded ? '...' : this._isLocal ? 'local' : 'v' + this._current;
    const title = !this._loaded ? '' : (this._isLocal ? 'Local dev' : 'v' + this._current) + ' \u2014 click to switch versions';

    if (!this._loaded || this._data.versions.length === 0) {
      this.innerHTML = `
        <div class="dropdown dropdown-bottom">
          <div tabindex="0" role="button"
               class="badge badge-sm badge-outline opacity-40 hover:opacity-80 cursor-pointer font-mono"
               title="${this._esc(title)}">${this._esc(label)}</div>
        </div>`;
      return;
    }

    const v = this._data;
    const releases = v.versions.map(r => this._renderRelease(r)).join('');
    const previews = v.previews.length > 0
      ? `<li class="menu-title mt-2 pt-2 border-t border-base-300">PR Previews</li>` +
        v.previews.map(p => `<li><a href="${this._esc(p.url)}" target="_blank">${this._esc(p.label)}</a></li>`).join('')
      : '';

    const localUrl = `http://localhost:${this._localPort}`;

    this.innerHTML = `
      <div class="dropdown dropdown-bottom">
        <div tabindex="0" role="button"
             class="badge badge-sm badge-outline opacity-40 hover:opacity-80 cursor-pointer font-mono"
             title="${this._esc(title)}">${this._esc(label)}</div>
        <ul tabindex="0" class="dropdown-content menu bg-base-200 rounded-box z-50 w-64 p-2 shadow-xl text-xs">
          <li class="menu-title">Releases</li>
          ${releases}
          ${previews}
          <li class="menu-title mt-2 pt-2 border-t border-base-300">Links</li>
          <li><a href="${localUrl}" class="${this._isLocal ? 'active font-bold' : ''}">
            Local Dev${this._isLocal ? ' (current)' : ''}
          </a></li>
          ${v.production ? `<li><a href="${this._esc(v.production)}" target="_blank">Production</a></li>` : ''}
          ${v.github ? `<li><a href="${this._esc(v.github + '/releases')}" target="_blank">GitHub Releases</a></li>` : ''}
        </ul>
      </div>`;
  }

  _renderRelease(r) {
    const isCurrent = r.version === this._current;
    const g = r.git;
    const date = r.date ? new Date(r.date).toLocaleDateString() : '';
    const parts = [date];
    if (g?.branch) parts.push(g.branch);
    if (r.commandCount) parts.push(r.commandCount + ' cmds');
    const meta = parts.filter(Boolean).join(' \u00b7 ');

    let metaHtml = '';
    if (meta || g?.commitSha) {
      let inner = this._esc(meta);
      if (g?.commitSha) {
        const sep = meta ? ' \u00b7 ' : '';
        inner += `${sep}<a href="${this._esc(g.commitUrl)}" target="_blank" title="${this._esc(g.commitMessage || '')}"
          class="underline" onclick="event.stopPropagation()">${this._esc(g.commitSha)}</a>`;
      }
      metaHtml = `<br><span class="opacity-50" style="font-size:0.65rem">${inner}</span>`;
    }

    const previewLink = r.previewUrl
      ? `<a href="${this._esc(r.previewUrl)}" target="_blank" title="Immutable preview URL"
          class="opacity-30 hover:opacity-80" onclick="event.stopPropagation()">\u29c9</a>`
      : '';

    return `<li>
      <a href="${this._esc(r.url)}"
         target="${isCurrent ? '' : '_blank'}"
         class="${isCurrent ? 'active font-bold' : ''} flex justify-between items-center gap-2">
        <span>
          <span>v${this._esc(r.version)}${isCurrent ? ' \u2713' : ''}</span>
          ${metaHtml}
        </span>
        ${previewLink}
      </a>
    </li>`;
  }

  /** Escape HTML to prevent XSS from manifest data */
  _esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

customElements.define('cf-version-picker', CfVersionPicker);
