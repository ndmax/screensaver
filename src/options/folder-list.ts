/**
 * The list of photo folders: add a path, remove one, and see each folder's
 * photo count or error.
 *
 * The folder list is the photoFolders setting; the service worker scans
 * folders when it changes and writes a status per folder, which this element
 * shows as it updates.
 */

import {css, html, LitElement, nothing} from 'lit';
import {customElement, property, query, state} from 'lit/decorators.js';
import {localize} from '../lib/locale';
import * as Log from '../lib/log';
import * as Settings from '../lib/settings';
import {errMsg} from '../lib/utils';
import {type FolderStatus, statusKey} from '../sources/folder_store';
import {pathToUrl, validateNewPath} from '../sources/folders';
import {icon} from './icons';
import {shared} from './styles';

@customElement('folder-list')
export class FolderList extends LitElement {
  static override styles = [shared, css`
    :host([disabled]) .content {
      opacity: 0.4;
      pointer-events: none;
    }

    .warning {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 16px;
      margin: 8px 24px 16px;
      padding: 12px 16px;
      border-left: 4px solid var(--warning-color);
      border-radius: 2px;
      background: var(--hover-color);
    }

    .warning p {
      flex: 1 1 240px;
      margin: 0;
    }

    .hint {
      margin: 8px 24px 16px;
      color: var(--secondary-text-color);
    }

    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .folder {
      display: flex;
      align-items: center;
      gap: 16px;
      min-height: 56px;
      padding: 4px 8px 4px 24px;
      border-bottom: 1px solid var(--divider-color);
    }

    .folder .icon {
      color: var(--secondary-text-color);
    }

    .labels {
      flex: 1;
      min-width: 0;
    }

    .path {
      overflow-wrap: anywhere;
    }

    .count,
    .error {
      margin-top: 2px;
      font-size: 14px;
      color: var(--secondary-text-color);
    }

    .error {
      color: var(--error-color);
    }

    form {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      padding: 16px 24px 0;
    }

    input {
      flex: 1 1 240px;
      min-width: 0;
      padding: 8px 4px;
      border: none;
      border-bottom: 1px solid var(--secondary-text-color);
      color: var(--primary-text-color);
      background: transparent;
      font: inherit;
    }

    input:focus {
      border-bottom: 2px solid var(--accent-color);
      outline: none;
      padding-bottom: 7px;
    }

    #addError {
      flex-basis: 100%;
      margin: 0;
      font-size: 14px;
    }
  `];

  @property({type: Boolean, reflect: true}) disabled = false;

  @state() private folders: string[] = [];
  @state() private statuses: Record<string, FolderStatus | undefined> = {};
  @state() private fileAccess = true;
  @state() private addError = '';
  @state() private canOpenSettings = true;

  @query('#path') private input!: HTMLInputElement;

  private unsubscribe?: () => void;

  override connectedCallback(): void {
    super.connectedCallback();
    this.unsubscribe = Settings.subscribe((keys) => {
      if (keys.includes('photoFolders')) {
        void this.load();
      }
    });
    chrome.storage.onChanged.addListener(this.onStorage);
    window.addEventListener('focus', this.checkFileAccess);
    document.addEventListener('visibilitychange', this.checkFileAccess);
    void Settings.ready().then(() => this.load());
    void this.checkFileAccess();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribe?.();
    chrome.storage.onChanged.removeListener(this.onStorage);
    window.removeEventListener('focus', this.checkFileAccess);
    document.removeEventListener('visibilitychange', this.checkFileAccess);
  }

  override render() {
    return html`
      <div class="section-title">${localize('folders_title')}</div>
      ${this.fileAccess ? nothing : html`
        <div id="fileAccess" class="warning" role="alert">
          <p>${localize('file_access_off')}</p>
          ${this.canOpenSettings ? html`
            <button id="openExtSettings" class="text-button" @click=${this.openExtSettings}>
              ${localize('open_ext_settings')}</button>` : nothing}
        </div>`}
      <div class="content">
        ${this.folders.length ? nothing : html`<p class="hint">${localize('folders_empty')}</p>`}
        <ul>
          ${this.folders.map((path) => html`
            <li class="folder" data-path=${path}>
              ${icon('folder')}
              <div class="labels">
                <div class="path">${path}</div>
                ${this.renderStatus(this.statuses[path])}
              </div>
              <button class="icon-button remove" title=${localize('folders_remove')}
                      aria-label=${`${localize('folders_remove')} ${path}`} ?disabled=${this.disabled}
                      @click=${() => this.removeFolder(path)}>${icon('close')}</button>
            </li>`)}
        </ul>
        <form @submit=${this.onSubmit}>
          <input id="path" type="text" spellcheck="false" autocomplete="off" ?disabled=${this.disabled}
                 placeholder=${localize('folders_path_placeholder')} aria-label=${localize('folders_path_placeholder')}
                 @input=${() => (this.addError = '')}>
          <button id="add" class="text-button" type="submit" ?disabled=${this.disabled}>${localize('folders_add')}</button>
          <p id="addError" class="error" role="alert" ?hidden=${!this.addError}>${this.addError}</p>
        </form>
      </div>`;
  }

  private renderStatus(s: FolderStatus | undefined) {
    if (!s || (s.scanning && !s.scannedAt)) {
      const found = s?.found ? ` ${s.found.toLocaleString()} ${localize('folders_found')}` : '';
      return html`<div class="count">${localize('folders_scanning')}${found}</div>`;
    }
    const parts = [`${s.count.toLocaleString()} ${localize('folders_photos')}`];
    if (s.skipped) {
      parts.push(`${s.skipped.toLocaleString()} ${localize('folders_skipped')}`);
    }
    if (s.scanning) {
      parts.push(localize('folders_scanning'));
    }
    return html`
      <div class="count">${parts.join(' · ')}</div>
      ${s.error ? html`<div class="error">${localize(s.error)}</div>` : nothing}`;
  }

  private async load(): Promise<void> {
    this.folders = [...Settings.get('photoFolders')];
    const keys = this.folders.map(statusKey);
    const stored = keys.length ? await chrome.storage.local.get(keys) : {};
    this.statuses = Object.fromEntries(this.folders.map((p) => [p, stored[statusKey(p)] as FolderStatus | undefined]));
  }

  private onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area !== 'local') {
      return;
    }
    let changed = false;
    const next = {...this.statuses};
    for (const path of this.folders) {
      const c = changes[statusKey(path)];
      if (c) {
        next[path] = c.newValue as FolderStatus | undefined;
        changed = true;
      }
    }
    if (changed) {
      this.statuses = next;
    }
  };

  private checkFileAccess = async (): Promise<void> => {
    if (document.visibilityState === 'hidden') {
      return;
    }
    this.fileAccess = await chrome.extension.isAllowedFileSchemeAccess();
  };

  private openExtSettings = async (): Promise<void> => {
    try {
      await chrome.tabs.create({url: `chrome://extensions/?id=${chrome.runtime.id}`});
    } catch (err) {
      Log.warn(errMsg(err), 'FolderList.openExtSettings');
      this.canOpenSettings = false;
    }
  };

  private onSubmit = (ev: Event): void => {
    ev.preventDefault();
    void this.addFolder(this.input.value.trim());
  };

  /** Check that a path is a readable folder, then add it */
  private async addFolder(path: string): Promise<void> {
    const invalid = validateNewPath(path, this.folders);
    if (invalid === 'empty') {
      return;
    }
    if (invalid) {
      this.addError = localize(invalid === 'duplicate' ? 'folder_err_duplicate' : 'folder_err_nested');
      return;
    }
    await this.checkFileAccess();
    if (!this.fileAccess) {
      this.addError = localize('folder_err_no_access');
      return;
    }
    const url = pathToUrl(path);
    try {
      await (await fetch(url)).text();
    } catch {
      // a file can be fetched without the trailing slash, a missing path can't
      const isFile = await fetch(url.slice(0, -1)).then(() => true, () => false);
      this.addError = localize(isFile ? 'folder_err_not_dir' : 'folder_err_not_found');
      return;
    }
    try {
      await Settings.set('photoFolders', [...Settings.get('photoFolders'), path]);
      this.input.value = '';
      this.addError = '';
      await this.load();
    } catch (err) {
      Log.error(errMsg(err), 'FolderList.addFolder');
    }
  }

  private async removeFolder(path: string): Promise<void> {
    try {
      await Settings.set('photoFolders', Settings.get('photoFolders').filter((p) => p !== path));
      await this.load();
    } catch (err) {
      Log.error(errMsg(err), 'FolderList.removeFolder');
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'folder-list': FolderList;
  }
}
