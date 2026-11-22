/**
 * Shows the last error the extension logged.
 *
 * Ported from elements/pages/error-page. The "email support" button is gone:
 * the original developer's support address is no longer monitored.
 */

import {css, html, LitElement} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {localize} from '../lib/locale';
import {type LastError, loadLastError, resetLastError} from '../lib/log';
import {icon} from './icons';
import {shared} from './styles';

@customElement('error-page')
export class ErrorPage extends LitElement {
  static override styles = [shared, css`
    .content {
      min-height: 50vh;
      padding: 16px 24px 24px;
    }

    h3 {
      margin: 0 0 8px;
      font-size: 20px;
      font-weight: 500;
    }

    .time {
      margin-bottom: 16px;
      color: var(--secondary-text-color);
      font-size: 14px;
    }

    .message {
      margin: 0 0 16px;
      font-size: 16px;
      white-space: pre-wrap;
    }

    pre {
      margin: 0;
      color: var(--secondary-text-color);
      font-size: 12px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `];

  @state() private lastError: LastError | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    chrome.storage.onChanged.addListener(this.onStorage);
    void this.load();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    chrome.storage.onChanged.removeListener(this.onStorage);
  }

  private async load(): Promise<void> {
    this.lastError = await loadLastError();
  }

  private onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area === 'local' && 'lastError' in changes) {
      void this.load();
    }
  };

  override render() {
    const err = this.lastError;
    return html`
      <section class="card">
        <div class="page-toolbar">
          <div class="title">${localize('last_error_viewer_title')}</div>
          <button class="icon-button" ?disabled=${!err} title=${localize('tooltip_error_delete')}
                  aria-label=${localize('tooltip_error_delete')} @click=${() => resetLastError()}>
            ${icon('delete')}
          </button>
        </div>
        <div class="content">
          ${err ? html`
            <h3>${err.title}</h3>
            <div class="time">${new Date(err.time).toLocaleString()}</div>
            <p class="message">${err.message}</p>
            <pre>${err.stack}</pre>
          ` : html`<p>${localize('no_error')}</p>`}
        </div>
      </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'error-page': ErrorPage;
  }
}
