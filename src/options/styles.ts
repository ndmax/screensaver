/**
 * Styles shared by the options page elements. Color tokens are defined on
 * :root in options.html, with a dark set selected by the darkMode setting.
 */

import {css} from 'lit';

/** Apply the darkMode setting to the page */
export function setDarkMode(dark: boolean): void {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export const shared = css`
  :host {
    display: block;
  }

  [hidden] {
    display: none !important;
  }

  .icon {
    display: block;
    flex: none;
  }

  button.icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  button.icon-button:hover:not(:disabled) {
    background: var(--hover-color);
  }

  button.icon-button:disabled {
    opacity: 0.38;
    cursor: default;
  }

  button.text-button {
    min-width: 64px;
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--accent-color);
    font: inherit;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
  }

  button.text-button:hover {
    background: var(--hover-color);
  }

  :focus-visible {
    outline: 2px solid var(--accent-color);
    outline-offset: 2px;
  }

  .card {
    max-width: 1000px;
    margin: 0 0 16px;
    background: var(--card-color);
    border-radius: 2px;
    box-shadow: 0 2px 2px 0 rgb(0 0 0 / 14%), 0 1px 5px 0 rgb(0 0 0 / 12%), 0 3px 1px -2px rgb(0 0 0 / 20%);
  }

  .page-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 64px;
    padding: 0 8px 0 24px;
    color: var(--primary-text-color);
    background: var(--toolbar-color);
    font-size: 20px;
    font-weight: 400;
    box-shadow: 0 1px 2px rgb(0 0 0 / 20%);
  }

  .page-toolbar .title {
    flex: 1;
  }

  .body-content {
    padding: 8px 0 16px;
  }

  .section-title {
    margin: 16px 24px 4px;
    color: var(--accent-color);
    font-size: 14px;
    font-weight: 500;
  }

  dialog {
    max-width: min(560px, calc(100vw - 32px));
    padding: 0;
    border: none;
    border-radius: 4px;
    color: var(--primary-text-color);
    background: var(--card-color);
    box-shadow: 0 11px 15px -7px rgb(0 0 0 / 20%), 0 24px 38px 3px rgb(0 0 0 / 14%);
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 40%);
  }

  dialog h2 {
    margin: 24px 24px 0;
    font-size: 20px;
    font-weight: 500;
  }

  dialog .dialog-body {
    margin: 20px 24px 24px;
    color: var(--secondary-text-color);
    white-space: pre-wrap;
  }

  dialog .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 8px;
  }
`;
