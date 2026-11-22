/**
 * fetch() with retry and exponential backoff on 5xx responses.
 *
 * Ported from @opus1269/chrome-ext-utils http.ts. OAuth token handling will
 * be added back with the Google Photos source.
 */

import {localize} from './locale';
import {checkNetworkConnection, wait} from './utils';

export interface HttpOptions {
  /** Max retries for 5xx responses */
  maxRetries?: number;
  /** Base delay in ms for backoff */
  delay?: number;
  headers?: Record<string, string>;
}

export function getError(response: Response): Error {
  const status = localize('err_status', 'Status');
  return new Error(`${status}: ${response.status}\n${response.statusText}`);
}

/**
 * GET a url. Resolves with the Response whether or not it is ok, so callers
 * can read API-specific error bodies.
 *
 * @throws An Error on network failure
 */
export async function get(url: string, opts: HttpOptions = {}): Promise<Response> {
  const {maxRetries = 4, delay = 1000, headers = {}} = opts;
  checkNetworkConnection();
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {method: 'GET', headers});
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(msg === 'Failed to fetch' ? localize('err_network', 'Network error') : msg, {cause: err});
    }
    const retryable = response.status >= 500 && response.status < 600;
    if (!retryable || attempt >= maxRetries) {
      return response;
    }
    await wait((2 ** (attempt + 1) - 1) * delay);
  }
}

/**
 * GET a url and parse JSON.
 *
 * @throws An Error if the request fails or the response is not ok
 */
export async function getJSON<T>(url: string, opts: HttpOptions = {}): Promise<T> {
  const response = await get(url, opts);
  if (!response.ok) {
    throw getError(response);
  }
  return (await response.json()) as T;
}
