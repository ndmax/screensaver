/**
 * i18n helpers.
 *
 * Ported from @opus1269/chrome-ext-utils locales.ts.
 */

/**
 * Get a localized string from _locales/<locale>/messages.json.
 *
 * @param key - message name
 * @param def - fallback if the message is missing
 */
export function localize(key: string, def = ''): string {
  const msg = chrome.i18n.getMessage(key);
  return msg || def;
}
