/**
 * Options page: the app shell, with a menu and the Settings, Error and Help
 * pages.
 */

import '@fontsource/roboto/latin-300.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import {css, html, LitElement, nothing} from 'lit';
import {customElement, query, state} from 'lit/decorators.js';
import {localize} from '../lib/locale';
import * as Log from '../lib/log';
import * as Msg from '../lib/msg';
import * as Settings from '../lib/settings';
import {errMsg, getVersion} from '../lib/utils';
import './error-page';
import './help-page';
import {icon, type IconName} from './icons';
import {type ShowErrorDetail} from './settings-page';
import './settings-page';
import {setDarkMode, shared} from './styles';

type Route = 'settings' | 'error' | 'help';

interface MenuItem {
  label: string;
  icon: IconName;
  /** Page to show */
  route?: Route;
  /** Action instead of a page */
  action?: () => void;
  divider?: boolean;
}

const ROUTES: Route[] = ['settings', 'error', 'help'];

function routeFromHash(): Route {
  const r = location.hash.slice(1) as Route;
  return ROUTES.includes(r) ? r : 'settings';
}

@customElement('options-app')
export class OptionsApp extends LitElement {
  static override styles = [shared, css`
    :host {
      --drawer-width: 256px;
      min-height: 100vh;
    }

    header {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 16px;
      height: 64px;
      padding: 0 16px 0 24px;
      color: var(--header-text-color);
      background: var(--header-color);
      font-size: 22px;
      box-shadow: 0 2px 4px rgb(0 0 0 / 25%);
    }

    header .menu-button {
      display: none;
      margin-left: -12px;
    }

    nav {
      position: fixed;
      top: 64px;
      bottom: 0;
      left: 0;
      z-index: 1;
      width: var(--drawer-width);
      overflow-y: auto;
      border-right: 1px solid var(--divider-color);
      background: var(--background-color);
    }

    nav ul {
      margin: 0;
      padding: 8px 0;
      list-style: none;
    }

    nav hr {
      margin: 8px 0;
      border: none;
      border-top: 1px solid var(--divider-color);
    }

    nav button {
      display: flex;
      align-items: center;
      gap: 32px;
      width: 100%;
      min-height: 48px;
      padding: 0 16px;
      border: none;
      color: var(--primary-text-color);
      background: transparent;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    nav button .icon {
      color: var(--secondary-text-color);
    }

    nav button:hover:not(:disabled) {
      background: var(--hover-color);
    }

    nav button[aria-current='page'] {
      color: var(--selected-item-color);
      background: var(--selected-item-background-color);
      font-weight: 500;
    }

    nav button:disabled {
      color: var(--disabled-text-color);
      cursor: default;
    }

    nav button:disabled .icon {
      opacity: 0.5;
    }

    .version {
      padding: 8px 16px 16px;
      color: var(--secondary-text-color);
      font-size: 12px;
    }

    main {
      margin-left: var(--drawer-width);
      padding: 16px;
    }

    .scrim {
      display: none;
    }

    @media (max-width: 800px) {
      header .menu-button {
        display: inline-flex;
      }

      nav {
        top: 0;
        z-index: 3;
        transform: translateX(-100%);
        transition: transform 0.2s ease-out;
        box-shadow: 0 8px 16px rgb(0 0 0 / 30%);
      }

      :host([drawer-open]) nav {
        transform: none;
      }

      :host([drawer-open]) .scrim {
        position: fixed;
        inset: 0;
        z-index: 2;
        display: block;
        background: rgb(0 0 0 / 40%);
      }

      main {
        margin-left: 0;
        padding: 8px 0;
      }
    }
  `];

  @state() private route: Route = routeFromHash();
  @state() private hasError = false;
  @state() private error: ShowErrorDetail | null = null;
  @state() private drawerOpen = false;

  @query('#errorDialog') private errorDialog!: HTMLDialogElement;

  private readonly menu: MenuItem[] = [
    {label: localize('menu_settings'), icon: 'settings', route: 'settings'},
    {label: localize('menu_preview'), icon: 'pageview', action: () => this.preview()},
    {label: localize('menu_error'), icon: 'error', route: 'error', divider: true},
    {label: localize('help'), icon: 'help', route: 'help'},
  ];

  private cleanup: (() => void)[] = [];

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('hashchange', this.onHashChange);
    chrome.storage.onChanged.addListener(this.onStorage);
    this.cleanup.push(
        () => window.removeEventListener('hashchange', this.onHashChange),
        () => chrome.storage.onChanged.removeListener(this.onStorage),
        Settings.subscribe((keys) => {
          if (keys.includes('darkMode')) {
            setDarkMode(Settings.get('darkMode'));
          }
        }),
    );
    this.addEventListener('show-error', this.onShowError);
    void this.updateHasError();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
    this.removeEventListener('show-error', this.onShowError);
  }

  override render() {
    return html`
      <header>
        <button class="icon-button menu-button" aria-label=${localize('menu')}
                @click=${() => this.setDrawer(!this.drawerOpen)}>${icon('menu')}</button>
        <div>${localize('chrome_extension_name')}</div>
      </header>

      <div class="scrim" @click=${() => this.setDrawer(false)}></div>
      <nav aria-label=${localize('menu')}>
        <ul>
          ${this.menu.map((item) => html`
            ${item.divider ? html`<hr>` : nothing}
            <li>
              <button aria-current=${item.route === this.route ? 'page' : nothing}
                      ?disabled=${item.route === 'error' && !this.hasError}
                      @click=${() => this.onMenu(item)}>
                ${icon(item.icon)}<span>${item.label}</span>
              </button>
            </li>`)}
        </ul>
        <div class="version">${localize('chrome_extension_name')} ${getVersion()}</div>
      </nav>

      <main>
        ${this.route === 'settings' ? html`<settings-page></settings-page>` : nothing}
        ${this.route === 'error' ? html`<error-page></error-page>` : nothing}
        ${this.route === 'help' ? html`<help-page></help-page>` : nothing}
      </main>

      <dialog id="errorDialog" @close=${() => (this.error = null)}>
        <h2>${this.error?.title}</h2>
        <div class="dialog-body">${this.error?.text}</div>
        <div class="buttons">
          <button class="text-button" autofocus @click=${() => this.errorDialog.close()}>${localize('close')}</button>
        </div>
      </dialog>`;
  }

  /** Show the error dialog */
  showError(title: string, text: string): void {
    this.error = {title, text};
    void this.updateComplete.then(() => {
      if (!this.errorDialog.open) {
        this.errorDialog.showModal();
      }
    });
  }

  private setDrawer(open: boolean): void {
    this.drawerOpen = open;
    this.toggleAttribute('drawer-open', open);
  }

  private onMenu(item: MenuItem): void {
    this.setDrawer(false);
    if (item.action) {
      item.action();
    } else if (item.route) {
      location.hash = item.route;
    }
  }

  private onHashChange = (): void => {
    this.route = routeFromHash();
    window.scrollTo(0, 0);
  };

  private preview(): void {
    Msg.send({message: 'showScreensaver'}).catch((err: unknown) => {
      Log.error(errMsg(err), 'OptionsApp.preview', localize('err_show_ss'));
    });
  }

  private async updateHasError(): Promise<void> {
    this.hasError = !!await Log.loadLastError();
    if (!this.hasError && this.route === 'error') {
      location.hash = 'settings';
    }
  }

  private onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area === 'local' && 'lastError' in changes) {
      void this.updateHasError();
    }
  };

  private onShowError = (ev: CustomEvent<ShowErrorDetail>): void => {
    this.showError(ev.detail.title, ev.detail.text);
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'options-app': OptionsApp;
  }
}

await Settings.ready();
setDarkMode(Settings.get('darkMode'));
document.body.append(document.createElement('options-app'));
