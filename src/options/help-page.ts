/**
 * Help links.
 *
 * Ported from elements/pages/help-page. The feedback section (support email
 * and GitHub issues) is gone: the original project is no longer maintained.
 * The documentation on GitHub Pages is still online and mostly applies.
 */

import {html, LitElement} from 'lit';
import {customElement} from 'lit/decorators.js';
import {localize} from '../lib/locale';
import './controls';
import {shared} from './styles';

const GITHUB = 'https://github.com/opus1269/screensaver/';
const PAGES = 'https://opus1269.github.io/screensaver/';

@customElement('help-page')
export class HelpPage extends LitElement {
  static override styles = shared;

  override render() {
    return html`
      <section class="card">
        <div class="page-toolbar"><div class="title">${localize('help')}</div></div>
        <div class="body-content">
          <setting-link label=${localize('help_documentation')} icon="info" url=${`${PAGES}documentation.html`}></setting-link>
          <setting-link label=${localize('help_faq')} icon="help" url=${`${PAGES}faq.html`}></setting-link>
          <setting-link label=${localize('help_contributors')} icon="github" url=${`${GITHUB}blob/master/CONTRIBUTORS.md`}></setting-link>
          <setting-link label=${localize('help_licenses')} icon="github" url=${`${GITHUB}blob/master/LICENSES.md`}></setting-link>
          <setting-link label=${localize('help_source_code')} icon="github" url=${GITHUB}></setting-link>
        </div>
      </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'help-page': HelpPage;
  }
}
