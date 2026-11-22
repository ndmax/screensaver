/**
 * Setting controls for the options page.
 *
 * Replaces @opus1269/common-custom-elements setting-toggle, setting-dropdown,
 * setting-slider, setting-time, setting-background and setting-link, which
 * were Polymer elements that each bound themselves to a localStorage key.
 * These are plain controls: the page passes the value in, and each control
 * fires a `setting-change` event ({name, value}) that the page persists.
 */

import {css, type CSSResultGroup, html, LitElement, nothing, type PropertyValues} from 'lit';
import {customElement, property, query} from 'lit/decorators.js';
import {live} from 'lit/directives/live.js';
import {localize} from '../lib/locale';
import type {UnitValue} from '../lib/settings';
import {icon, type IconName} from './icons';
import {shared} from './styles';
import {type Unit, withDisplay, withUnit} from './units';

export interface SettingChangeDetail<T = unknown> {
  name: string;
  value: T;
}

export type SettingChangeEvent<T = unknown> = CustomEvent<SettingChangeDetail<T>>;

/** Common properties and the row layout */
abstract class SettingBase extends LitElement {
  static override styles: CSSResultGroup = [shared, css`
    :host {
      position: relative;
    }

    :host([disabled]) {
      pointer-events: none;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 16px;
      min-height: 48px;
      padding: 8px 24px;
      border-bottom: 1px solid var(--divider-color);
    }

    :host([noseparator]) .row {
      border-bottom-color: transparent;
    }

    :host([indent]) .row {
      padding-left: 48px;
    }

    .labels {
      flex: 1;
      min-width: 0;
    }

    .main-label {
      color: var(--setting-item-color);
    }

    .secondary-label {
      margin-top: 2px;
      color: var(--secondary-text-color);
      font-size: 14px;
    }

    :host([disabled]) .main-label,
    :host([disabled]) .secondary-label,
    :host([disabled]) .control {
      opacity: 0.4;
    }
  `];

  /** Setting key */
  @property() name = '';
  @property() sectionTitle = '';
  @property() mainLabel = '';
  @property() secondaryLabel = '';
  @property({type: Boolean, reflect: true}) disabled = false;
  @property({type: Boolean, reflect: true}) indent = false;
  @property({type: Boolean, reflect: true}) noseparator = false;

  protected emit(value: unknown): void {
    this.dispatchEvent(new CustomEvent<SettingChangeDetail>('setting-change', {
      detail: {name: this.name, value},
      bubbles: true,
      composed: true,
    }));
  }

  protected sectionHeader() {
    return this.sectionTitle ? html`<div class="section-title">${this.sectionTitle}</div>` : nothing;
  }

  protected labels(forId?: string) {
    return html`
      <label class="labels" for=${forId ?? nothing}>
        <div class="main-label">${this.mainLabel}</div>
        ${this.secondaryLabel ? html`<div class="secondary-label">${this.secondaryLabel}</div>` : nothing}
      </label>`;
  }
}

/** On/off setting */
@customElement('setting-toggle')
export class SettingToggle extends SettingBase {
  static override styles = [SettingBase.styles, css`
    .row {
      cursor: pointer;
    }

    input {
      appearance: none;
      position: relative;
      flex: none;
      width: 36px;
      height: 14px;
      margin: 0 4px;
      border-radius: 7px;
      background: var(--toggle-track-color);
      cursor: pointer;
      transition: background 0.15s;
    }

    input::before {
      content: '';
      position: absolute;
      top: -3px;
      left: -4px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--toggle-thumb-color);
      box-shadow: 0 1px 3px rgb(0 0 0 / 40%);
      transition: transform 0.15s, background 0.15s;
    }

    input:checked {
      background: var(--toggle-checked-track-color);
    }

    input:checked::before {
      transform: translateX(24px);
      background: var(--accent-color);
    }
  `];

  @property({type: Boolean}) checked = false;

  override render() {
    return html`
      ${this.sectionHeader()}
      <div class="row">
        ${this.labels('input')}
        <input id="input" class="control" type="checkbox" role="switch"
               .checked=${live(this.checked)} ?disabled=${this.disabled}
               @change=${this.onChange}>
      </div>`;
  }

  private onChange = (ev: Event): void => {
    this.emit((ev.target as HTMLInputElement).checked);
  };
}

/** Pick one of a list; the value is the item index */
@customElement('setting-select')
export class SettingSelect extends SettingBase {
  static override styles = [SettingBase.styles, css`
    select {
      min-width: 180px;
      padding: 6px 8px;
      border: none;
      border-bottom: 1px solid var(--secondary-text-color);
      color: var(--primary-text-color);
      background: transparent;
      font: inherit;
      cursor: pointer;
    }

    option {
      color: var(--primary-text-color);
      background: var(--card-color);
    }
  `];

  @property({attribute: false}) items: string[] = [];
  @property({type: Number}) value = 0;

  override render() {
    return html`
      ${this.sectionHeader()}
      <div class="row">
        ${this.labels('select')}
        <select id="select" class="control" ?disabled=${this.disabled} @change=${this.onChange}>
          ${this.items.map((item, i) => html`<option value=${i} ?selected=${i === this.value}>${item}</option>`)}
        </select>
      </div>`;
  }

  protected override updated(): void {
    // keep the DOM in sync when a change is rejected or another tab writes
    const select = this.renderRoot.querySelector('select');
    if (select && select.selectedIndex !== this.value) {
      select.selectedIndex = this.value;
    }
  }

  private onChange = (ev: Event): void => {
    this.emit((ev.target as HTMLSelectElement).selectedIndex);
  };
}

/** A number with a choice of units, stored as a UnitValue */
@customElement('setting-slider')
export class SettingSlider extends SettingBase {
  static override styles = [SettingBase.styles, css`
    .row {
      flex-wrap: wrap;
      row-gap: 0;
    }

    .labels {
      flex-basis: 100%;
    }

    .controls {
      display: flex;
      flex: 1;
      align-items: center;
      gap: 16px;
    }

    input[type='range'] {
      flex: 1;
      accent-color: var(--accent-color);
      cursor: pointer;
    }

    input[type='number'] {
      width: 4.5em;
      padding: 4px;
      border: none;
      border-bottom: 1px solid var(--secondary-text-color);
      color: var(--primary-text-color);
      background: transparent;
      font: inherit;
      text-align: right;
    }

    select {
      width: 120px;
      padding: 6px 8px;
      border: none;
      border-bottom: 1px solid var(--secondary-text-color);
      color: var(--primary-text-color);
      background: transparent;
      font: inherit;
      cursor: pointer;
    }

    option {
      background: var(--card-color);
    }
  `];

  @property({attribute: false}) units: Unit[] = [];
  @property({attribute: false}) value: UnitValue = {base: 1, display: 1, unit: 0};

  override render() {
    const u = this.units[this.value.unit] ?? this.units[0];
    if (!u) {
      return nothing;
    }
    return html`
      ${this.sectionHeader()}
      <div class="row">
        ${this.labels('range')}
        <div class="controls control">
          <input id="range" type="range" min=${u.min} max=${u.max} step=${u.step}
                 .value=${live(String(this.value.display))} ?disabled=${this.disabled}
                 aria-label=${this.mainLabel}
                 @input=${this.onRangeInput} @change=${this.onDisplayChange}>
          <input type="number" min=${u.min} max=${u.max} step=${u.step}
                 .value=${live(String(this.value.display))} ?disabled=${this.disabled}
                 aria-label=${`${this.mainLabel} (${u.name})`}
                 @change=${this.onDisplayChange}>
          <select ?disabled=${this.disabled} aria-label=${localize('units')} @change=${this.onUnitChange}>
            ${this.units.map((unit, i) => html`<option value=${i} ?selected=${i === this.value.unit}>${unit.name}</option>`)}
          </select>
        </div>
      </div>`;
  }

  /** Show the number while dragging; save when released */
  private onRangeInput = (ev: Event): void => {
    const num = this.renderRoot.querySelector<HTMLInputElement>('input[type=number]');
    if (num) {
      num.value = (ev.target as HTMLInputElement).value;
    }
  };

  private onDisplayChange = (ev: Event): void => {
    const next = withDisplay(this.units, this.value, Number((ev.target as HTMLInputElement).value));
    this.value = next;
    this.emit(next);
  };

  private onUnitChange = (ev: Event): void => {
    const next = withUnit(this.units, this.value, (ev.target as HTMLSelectElement).selectedIndex);
    this.value = next;
    this.emit(next);
  };
}

/** A time of day, 'HH:MM' */
@customElement('setting-time')
export class SettingTime extends SettingBase {
  static override styles = [SettingBase.styles, css`
    input {
      padding: 4px;
      border: none;
      border-bottom: 1px solid var(--secondary-text-color);
      color: var(--primary-text-color);
      background: transparent;
      font: inherit;
      color-scheme: inherit;
    }
  `];

  @property() value = '00:00';

  override render() {
    return html`
      ${this.sectionHeader()}
      <div class="row">
        ${this.labels('time')}
        <input id="time" class="control" type="time" required .value=${live(this.value)}
               ?disabled=${this.disabled} @change=${this.onChange}>
      </div>`;
  }

  private onChange = (ev: Event): void => {
    const value = (ev.target as HTMLInputElement).value;
    // empty while the user is part way through editing
    if (/^\d\d:\d\d$/.test(value)) {
      this.emit(value);
    }
  };
}

/** Screensaver backgrounds. The setting stores 'background:' + css. */
export const BACKGROUNDS = [
  'linear-gradient(to bottom, #3a3a3a, #b5bdc8)',
  'linear-gradient(to bottom, #003973 10%, #e5e5be 90%)',
  'linear-gradient(to top, #649173 10%, #dbd5a4 90%)',
  'radial-gradient(ellipse at center, #ebe9f9 0%, #ebe9f9 23%, #d8d0ef 50%, #cec7ec 51%, #ebe9f9 77%, #c1bfea 100%)',
  'radial-gradient(ellipse farthest-corner at 0px 0px, #fd5c6e 0%, rgba(0, 0, 255, 0) 50%, #0ce4e1 95%)',
  'black',
] as const;

const BG_PREFIX = 'background:';

function bgCss(value: string): string {
  return value.startsWith(BG_PREFIX) ? value.slice(BG_PREFIX.length) : value;
}

/** Choose the screensaver background from a dialog */
@customElement('setting-background')
export class SettingBackground extends SettingBase {
  static override styles = [SettingBase.styles, css`
    .row {
      cursor: pointer;
    }

    .current {
      flex: none;
      width: 100px;
      height: 56px;
      padding: 0;
      border: 1px solid var(--divider-color);
      cursor: pointer;
    }

    .swatches {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
      width: min(460px, calc(100vw - 80px));
      margin: 20px 24px 8px;
    }

    .swatch {
      aspect-ratio: 16 / 9;
      padding: 0;
      border: 4px solid transparent;
      border-radius: 2px;
      cursor: pointer;
    }

    .swatch[aria-checked='true'] {
      border-color: var(--accent-color);
    }
  `];

  @property() value: string = `${BG_PREFIX}${BACKGROUNDS[0]}`;
  /** Index picked in the open dialog */
  private pick = -1;

  @query('dialog') private dialog!: HTMLDialogElement;

  override render() {
    const current = BACKGROUNDS.findIndex((b) => b === bgCss(this.value));
    return html`
      ${this.sectionHeader()}
      <div class="row" @click=${this.open}>
        ${this.labels('current')}
        <button id="current" class="current control" style="background:${bgCss(this.value)}"
                ?disabled=${this.disabled} aria-label=${this.mainLabel}></button>
      </div>
      <dialog @close=${this.onClose}>
        <h2>${localize('setting_bg_dialog_title')}</h2>
        <div class="swatches" role="radiogroup">
          ${BACKGROUNDS.map((bg, i) => html`
            <button class="swatch" role="radio" style="background:${bg}"
                    aria-checked=${i === (this.pick === -1 ? current : this.pick) ? 'true' : 'false'}
                    aria-label=${String(i + 1)}
                    @click=${() => this.select(i)} @dblclick=${() => this.dialog.close('ok')}></button>`)}
        </div>
        <div class="buttons">
          <button class="text-button" @click=${() => this.dialog.close('cancel')}>${localize('cancel')}</button>
          <button class="text-button" autofocus @click=${() => this.dialog.close('ok')}>${localize('ok')}</button>
        </div>
      </dialog>`;
  }

  private open = (): void => {
    if (this.disabled) {
      return;
    }
    this.pick = -1;
    this.requestUpdate();
    this.dialog.showModal();
  };

  private select(i: number): void {
    this.pick = i;
    this.requestUpdate();
  }

  private onClose = (): void => {
    if (this.dialog.returnValue === 'ok' && this.pick !== -1) {
      this.emit(`${BG_PREFIX}${BACKGROUNDS[this.pick]}`);
    }
    this.pick = -1;
    this.dialog.returnValue = '';
  };

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('disabled') && this.disabled && this.dialog?.open) {
      this.dialog.close('cancel');
    }
  }
}

/** A row that opens a web page */
@customElement('setting-link')
export class SettingLink extends LitElement {
  static override styles = [shared, css`
    a {
      display: flex;
      align-items: center;
      gap: 32px;
      min-height: 48px;
      padding: 4px 24px;
      color: var(--primary-text-color);
      text-decoration: none;
    }

    a:hover {
      background: var(--hover-color);
    }

    .icon {
      color: var(--secondary-text-color);
    }
  `];

  @property() label = '';
  @property() url = '';
  @property() icon: IconName = 'info';

  override render() {
    return html`<a href=${this.url} target="_blank" rel="noopener">${icon(this.icon)}<span>${this.label}</span></a>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'setting-toggle': SettingToggle;
    'setting-select': SettingSelect;
    'setting-slider': SettingSlider;
    'setting-time': SettingTime;
    'setting-background': SettingBackground;
    'setting-link': SettingLink;
  }
  interface HTMLElementEventMap {
    'setting-change': SettingChangeEvent;
  }
}
