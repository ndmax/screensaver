/**
 * TEMPORARY options page for exercising the service worker. The full options
 * UI (settings-page, help, error viewer, Google Photos) is ported in step 4.
 */

import {css, html, LitElement} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {localize} from '../lib/locale';
import {type LastError, loadLastError, resetLastError} from '../lib/log';
import * as Msg from '../lib/msg';
import * as Settings from '../lib/settings';
import {USE_KEYS, type UseKey} from '../sources/photo_source';

const SOURCE_LABELS: Record<UseKey, string> = {
  useArchitectureUnsplash: 'setting_unsplash_architecture',
  useNatureUnsplash: 'setting_unsplash_nature',
  usePeopleUnsplash: 'setting_unsplash_people',
  useCityUnsplash: 'setting_unsplash_city',
};

@customElement('options-app')
export class OptionsApp extends LitElement {
  static override styles = css`
    :host { display: block; max-width: 640px; margin: 24px auto; padding: 0 16px; }
    h1 { font-size: 1.4rem; }
    .note { background: #fff3cd; padding: 8px 12px; border-radius: 4px; }
    label { display: block; margin: 8px 0; }
    button { margin-right: 8px; }
    .error { background: #fdecea; padding: 8px 12px; border-radius: 4px; white-space: pre-wrap; }
  `;

  @state() private settings: Settings.Settings | null = null;
  @state() private lastError: LastError | null = null;
  @state() private sourceErrors: string[] = [];

  private unsubscribe?: () => void;
  private unlisten?: () => void;

  override connectedCallback(): void {
    super.connectedCallback();
    void this.load();
    this.unsubscribe = Settings.subscribe(() => {
      this.settings = Settings.getAll();
    });
    this.unlisten = Msg.listen((msg) => {
      if (msg.message === 'photoSourceFailed') {
        this.sourceErrors = [...this.sourceErrors, `${msg.key}: ${msg.error}`];
      }
      return undefined;
    });
    chrome.storage.onChanged.addListener(this.onStorage);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribe?.();
    this.unlisten?.();
    chrome.storage.onChanged.removeListener(this.onStorage);
  }

  private onStorage = (changes: Record<string, chrome.storage.StorageChange>): void => {
    if ('lastError' in changes) {
      void loadLastError().then((err) => (this.lastError = err));
    }
  };

  private async load(): Promise<void> {
    await Settings.ready();
    this.settings = Settings.getAll();
    this.lastError = await loadLastError();
  }

  private toggle(key: 'enabled' | UseKey, ev: Event): void {
    void Settings.set(key, (ev.target as HTMLInputElement).checked);
  }

  override render() {
    const s = this.settings;
    if (!s) {
      return html`<p>Loading…</p>`;
    }
    return html`
      <h1>${localize('chrome_extension_name')}</h1>
      <p class="note">Temporary options page (MV3 port in progress).</p>

      <label>
        <input type="checkbox" .checked=${s.enabled} @change=${(e: Event) => this.toggle('enabled', e)}>
        ${localize('screensaver')} ${s.enabled ? localize('on') : localize('off')}
      </label>

      <h2>${localize('tab_sources')}</h2>
      ${USE_KEYS.map((key) => html`
        <label>
          <input type="checkbox" .checked=${s[key]} @change=${(e: Event) => this.toggle(key, e)}>
          ${localize(SOURCE_LABELS[key])}
        </label>`)}

      <p>
        <button @click=${() => Msg.broadcast({message: 'showScreensaver'})}>${localize('menu_preview')}</button>
        <button @click=${() => Msg.broadcast({message: 'restoreDefaults'})}>${localize('tooltip_restore')}</button>
      </p>

      ${this.sourceErrors.map((e) => html`<p class="error">${e}</p>`)}
      ${this.lastError ? html`
        <h2>${localize('menu_error')}</h2>
        <div class="error">${this.lastError.title}\n${this.lastError.message}</div>
        <p><button @click=${() => resetLastError()}>${localize('tooltip_error_delete')}</button></p>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'options-app': OptionsApp;
  }
}
