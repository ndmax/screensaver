/**
 * The Settings page: three tabs of setting controls.
 *
 * Ported from elements/pages/settings-page. The original's online photo
 * sources (Google Photos, Flickr, reddit, Chromecast, Unsplash) and weather
 * are gone; photos come from local folders (the folder-list element).
 */

import {css, html, LitElement, nothing} from 'lit';
import {customElement, query, state} from 'lit/decorators.js';
import {live} from 'lit/directives/live.js';
import {localize} from '../lib/locale';
import * as Log from '../lib/log';
import * as Msg from '../lib/msg';
import * as Permissions from '../lib/permissions';
import * as Settings from '../lib/settings';
import type {SettingKey} from '../lib/settings';
import {TIME_FORMAT} from '../lib/time';
import {errMsg} from '../lib/utils';
import type {SettingChangeEvent} from './controls';
import './controls';
import './folder-list';
import {icon} from './icons';
import {shared} from './styles';
import {idleTimeUnits, transitionTimeUnits} from './units';

export const TAB = {CONTROLS: 0, DISPLAY: 1, SOURCES: 2} as const;
type Tab = (typeof TAB)[keyof typeof TAB];

const HELP_URL = 'https://opus1269.github.io/screensaver/help/settings.html';
const HELP_ANCHORS = ['ss_controls', 'display_controls', 'photo_sources'];

export interface ShowErrorDetail {
  title: string;
  text: string;
}

/** Ask the app shell to show the error dialog */
export function showError(from: Element, title: string, text: string): void {
  from.dispatchEvent(new CustomEvent<ShowErrorDetail>('show-error', {
    detail: {title, text},
    bubbles: true,
    composed: true,
  }));
}

@customElement('settings-page')
export class SettingsPage extends LitElement {
  static override styles = [shared, css`
    .page-toolbar {
      flex-wrap: wrap;
      padding-top: 8px;
    }

    .enabled-label {
      flex: 1;
      cursor: pointer;
    }

    .main-toggle {
      appearance: none;
      position: relative;
      width: 36px;
      height: 14px;
      margin: 0 12px 0 8px;
      border-radius: 7px;
      background: var(--toggle-track-color);
      cursor: pointer;
    }

    .main-toggle::before {
      content: '';
      position: absolute;
      top: -3px;
      left: -4px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--toggle-thumb-color);
      box-shadow: 0 1px 3px rgb(0 0 0 / 40%);
      transition: transform 0.15s;
    }

    .main-toggle:checked {
      background: var(--toggle-checked-track-color);
    }

    .main-toggle:checked::before {
      transform: translateX(24px);
      background: var(--accent-color);
    }

    [role='tablist'] {
      display: flex;
      flex-basis: 100%;
      margin: 8px -8px 0 -24px;
      overflow-x: auto;
    }

    [role='tab'] {
      flex: 1;
      min-width: max-content;
      padding: 14px 16px 12px;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--secondary-text-color);
      background: transparent;
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }

    [role='tab'][aria-selected='true'] {
      border-bottom-color: var(--accent-color);
      color: var(--primary-text-color);
    }

    .note {
      padding: 16px 24px 0;
      color: var(--secondary-text-color);
      font-size: 14px;
    }
  `];

  @state() private s: Settings.Settings | null = null;
  @state() private tab: Tab = TAB.CONTROLS;

  @query('#confirmRestore') private confirmRestore!: HTMLDialogElement;

  private unsubscribe?: () => void;

  // menus, localized once
  private readonly idleUnits = idleTimeUnits();
  private readonly transitionUnits = transitionTimeUnits();
  private readonly sizingMenu = ['menu_letterbox', 'menu_zoom', 'menu_frame', 'menu_full', 'menu_random']
      .map((k) => localize(k));
  private readonly transitionMenu = ['menu_scale_up', 'menu_fade', 'menu_slide_from_right', 'menu_slide_down',
    'menu_spin_up', 'menu_slide_up', 'menu_slide_from_bottom', 'menu_slide_right', 'menu_random']
      .map((k) => localize(k));
  private readonly timeMenu = ['no', 'menu_12_hour', 'menu_24_hour'].map((k) => localize(k));

  override connectedCallback(): void {
    super.connectedCallback();
    this.unsubscribe = Settings.subscribe(() => {
      this.s = Settings.getAll();
    });
    void Settings.ready().then(() => {
      this.s = Settings.getAll();
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribe?.();
  }

  override render() {
    const s = this.s;
    if (!s) {
      return nothing;
    }
    const off = !s.enabled;
    return html`
      <section class="card">
        <div class="page-toolbar">
          <label class="enabled-label" for="enabled">
            ${localize('screensaver')} ${s.enabled ? localize('on') : localize('off')}
          </label>
          <button id="restore" class="icon-button" ?disabled=${off}
                  title=${localize('tooltip_restore')} aria-label=${localize('tooltip_restore')}
                  @click=${() => this.confirmRestore.showModal()}>${icon('settings-backup-restore')}</button>
          <button class="icon-button" title=${localize('help')} aria-label=${localize('help')}
                  @click=${this.openHelp}>${icon('help')}</button>
          <input id="enabled" class="main-toggle" type="checkbox" role="switch" .checked=${live(s.enabled)}
                 title=${localize('tooltip_settings_toggle')}
                 @change=${(e: Event) => this.save('enabled', (e.target as HTMLInputElement).checked)}>
          <div role="tablist">
            ${[localize('tab_slideshow'), localize('tab_display'), localize('tab_sources')].map((label, i) => html`
              <button role="tab" aria-selected=${this.tab === i ? 'true' : 'false'}
                      @click=${() => (this.tab = i as Tab)}>${label}</button>`)}
          </div>
        </div>
        <div class="body-content" @setting-change=${this.onSettingChange}>
          ${this.renderTab(s, off)}
        </div>
      </section>

      <dialog id="confirmRestore" @close=${this.onConfirmRestore}>
        <h2>${localize('tooltip_restore')}</h2>
        <div class="dialog-body">${localize('confirm_restore')}</div>
        <div class="buttons">
          <button class="text-button" autofocus @click=${() => this.confirmRestore.close('cancel')}>${localize('cancel')}</button>
          <button class="text-button" @click=${() => this.confirmRestore.close('ok')}>${localize('ok')}</button>
        </div>
      </dialog>`;
  }

  private renderTab(s: Settings.Settings, off: boolean) {
    switch (this.tab) {
      case TAB.DISPLAY:
        return this.displayTab(s, off);
      case TAB.SOURCES:
        return this.sourcesTab(off);
      default:
        return this.controlsTab(s, off);
    }
  }

  private controlsTab(s: Settings.Settings, off: boolean) {
    return html`
      <setting-slider name="idleTime" sectionTitle=${localize('settings_appearance')}
                      mainLabel=${localize('setting_idle_time')} .units=${this.idleUnits}
                      .value=${s.idleTime} ?disabled=${off}></setting-slider>
      <setting-slider name="transitionTime" mainLabel=${localize('setting_transition_time')}
                      .units=${this.transitionUnits} .value=${s.transitionTime} ?disabled=${off}></setting-slider>
      <setting-select name="photoTransition" mainLabel=${localize('setting_photo_transition')}
                      .items=${this.transitionMenu} .value=${s.photoTransition} ?disabled=${off}></setting-select>
      <setting-select name="photoSizing" mainLabel=${localize('setting_photo_sizing')}
                      .items=${this.sizingMenu} .value=${s.photoSizing} ?disabled=${off}></setting-select>
      <setting-toggle name="panAndScan" mainLabel=${localize('setting_pan_and_scan')}
                      secondaryLabel=${localize('setting_pan_and_scan_desc')} noseparator
                      .checked=${s.panAndScan} ?disabled=${off}></setting-toggle>
      <setting-toggle name="detectFaces" mainLabel=${localize('setting_detect_faces')}
                      secondaryLabel=${localize('setting_detect_faces_desc')} indent
                      .checked=${s.detectFaces} ?disabled=${off || !s.panAndScan}></setting-toggle>
      <setting-background name="background" mainLabel=${localize('setting_bg')}
                          secondaryLabel=${localize('setting_bg_desc')}
                          .value=${s.background} ?disabled=${off}></setting-background>
      <setting-toggle name="darkMode" mainLabel=${localize('setting_dark_mode')}
                      secondaryLabel=${localize('setting_dark_mode_desc')}
                      .checked=${s.darkMode}></setting-toggle>

      <setting-toggle name="allowBackground" sectionTitle=${localize('settings_behavior')}
                      mainLabel=${localize('setting_background')}
                      secondaryLabel=${localize('setting_background_desc')}
                      .checked=${s.allowBackground} ?disabled=${off}></setting-toggle>
      <setting-toggle name="interactive" mainLabel=${localize('setting_interactive')}
                      secondaryLabel=${localize('setting_interactive_desc')}
                      .checked=${s.interactive} ?disabled=${off}></setting-toggle>
      <setting-toggle name="shuffle" mainLabel=${localize('setting_shuffle')}
                      secondaryLabel=${localize('setting_shuffle_desc')}
                      .checked=${s.shuffle} ?disabled=${off}></setting-toggle>
      <setting-toggle name="skip" mainLabel=${localize('setting_skip')}
                      secondaryLabel=${localize('setting_skip_desc')}
                      .checked=${s.skip} ?disabled=${off}></setting-toggle>
      <setting-toggle name="allowPhotoClicks" mainLabel=${localize('setting_photo_clicks')}
                      .checked=${s.allowPhotoClicks} ?disabled=${off}></setting-toggle>

      <setting-toggle name="showPhotog" sectionTitle=${localize('settings_extras')}
                      mainLabel=${localize('setting_photog')}
                      .checked=${s.showPhotog} ?disabled=${off}></setting-toggle>
      <setting-select name="showTime" mainLabel=${localize('setting_show_time')} noseparator
                      .items=${this.timeMenu} .value=${s.showTime} ?disabled=${off}></setting-select>
      <setting-toggle name="largeTime" mainLabel=${localize('setting_large_time')} indent noseparator
                      .checked=${s.largeTime}
                      ?disabled=${off || s.showTime === TIME_FORMAT.NONE}></setting-toggle>`;
  }

  private displayTab(s: Settings.Settings, off: boolean) {
    const sleepOff = !s.keepAwake;
    return html`
      <setting-toggle name="allDisplays" mainLabel=${localize('setting_all_displays')}
                      secondaryLabel=${localize('setting_all_displays_desc')}
                      .checked=${s.allDisplays} ?disabled=${off}></setting-toggle>
      <setting-toggle name="chromeFullscreen" mainLabel=${localize('setting_full_screen')}
                      secondaryLabel=${localize('setting_full_screen_desc')}
                      .checked=${s.chromeFullscreen} ?disabled=${off}></setting-toggle>
      <setting-toggle name="keepAwake" mainLabel=${localize('setting_keep_awake')}
                      secondaryLabel=${localize('setting_keep_awake_desc')} noseparator
                      title=${localize('tooltip_keep_awake')}
                      .checked=${s.keepAwake}></setting-toggle>
      <setting-time name="activeStart" mainLabel=${localize('setting_start_time')}
                    secondaryLabel=${localize('setting_start_time_desc')} indent noseparator
                    .value=${s.activeStart} ?disabled=${sleepOff}></setting-time>
      <setting-time name="activeStop" mainLabel=${localize('setting_stop_time')}
                    secondaryLabel=${localize('setting_stop_time_desc')} indent noseparator
                    .value=${s.activeStop} ?disabled=${sleepOff}></setting-time>
      <setting-toggle name="allowSuspend" mainLabel=${localize('setting_suspend')}
                      secondaryLabel=${localize('setting_suspend_desc')} indent
                      .checked=${s.allowSuspend} ?disabled=${sleepOff}></setting-toggle>`;
  }

  private sourcesTab(off: boolean) {
    return html`<folder-list ?disabled=${off}></folder-list>`;
  }

  /** Persist a setting and re-render now, rather than on the storage echo */
  private async save<K extends SettingKey>(key: K, value: Settings.Settings[K]): Promise<void> {
    try {
      await Settings.set(key, value);
    } catch (err) {
      Log.error(errMsg(err), 'SettingsPage.save');
    }
    this.s = Settings.getAll();
  }

  private onSettingChange = (ev: SettingChangeEvent): void => {
    const {name, value} = ev.detail;
    if (!Settings.isSettingKey(name)) {
      return;
    }
    switch (name) {
      case 'allowBackground':
        void this.setWithPermission(name, value as boolean, Permissions.BACKGROUND, '');
        break;
      default:
        void this.save(name, value as never);
    }
  };

  /**
   * Turn on a setting that needs an optional permission, or turn it off and
   * give the permission back. Chrome only shows the permission prompt during
   * a user gesture, so the request is made before anything else is awaited.
   *
   * @param errText - shown if the user denies the permission; none if empty
   */
  private async setWithPermission(key: 'allowBackground', on: boolean,
                                  perm: Permissions.PermType, errText: string): Promise<void> {
    if (!on) {
      await this.save(key, false);
      await Permissions.remove(perm).catch((err: unknown) => Log.warn(errMsg(err), 'SettingsPage.remove'));
      return;
    }
    let granted = false;
    let error = '';
    try {
      granted = await Permissions.request(perm);
    } catch (err) {
      error = errMsg(err);
    }
    await this.save(key, granted);
    if (!granted && (error || errText)) {
      showError(this, localize('err_optional_permissions'), error || errText);
    }
  }

  private onConfirmRestore = (): void => {
    if (this.confirmRestore.returnValue === 'ok') {
      Msg.send({message: 'restoreDefaults'}).catch((err: unknown) => {
        Log.error(errMsg(err), 'SettingsPage.restoreDefaults');
      });
    }
    this.confirmRestore.returnValue = '';
  };

  private openHelp = (): void => {
    window.open(`${HELP_URL}#${HELP_ANCHORS[this.tab]}`, '_blank', 'noopener');
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'settings-page': SettingsPage;
  }
  interface HTMLElementEventMap {
    'show-error': CustomEvent<ShowErrorDetail>;
  }
}
