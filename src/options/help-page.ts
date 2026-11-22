/** Help links, to this fork's GitHub repository. */

import {html, LitElement} from 'lit';
import {customElement} from 'lit/decorators.js';
import {localize} from '../lib/locale';
import './controls';
import {shared} from './styles';

const GITHUB = 'https://github.com/ndmax/screensaver/';

@customElement('help-page')
export class HelpPage extends LitElement {
  static override styles = shared;

  override render() {
    return html`
      <section class="card">
        <div class="page-toolbar"><div class="title">${localize('help')}</div></div>
        <div class="body-content">
          <setting-link label=${localize('help_documentation')} icon="info" url=${`${GITHUB}#readme`}></setting-link>
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
