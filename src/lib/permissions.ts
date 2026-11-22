/**
 * The optional "background" permission, which keeps Chrome running after its
 * windows are closed (and starts it at login) so the screensaver can show.
 */

const BACKGROUND: chrome.permissions.Permissions = {permissions: ['background']};

/**
 * Request the permission. Must be called from a user gesture in an extension
 * page.
 *
 * @returns true if granted
 */
export function requestBackground(): Promise<boolean> {
  return chrome.permissions.request(BACKGROUND);
}

/** Give the permission back, if held */
export async function removeBackground(): Promise<void> {
  if (await chrome.permissions.contains(BACKGROUND)) {
    await chrome.permissions.remove(BACKGROUND);
  }
}
