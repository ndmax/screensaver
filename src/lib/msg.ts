/**
 * Typed runtime messages between extension contexts.
 *
 * Replaces @opus1269/chrome-ext-utils msg.ts and scripts/my_msg.ts.
 * The original STORE and HIGHLIGHT messages are gone: chrome.storage.onChanged
 * reaches every context, and chrome.runtime.openOptionsPage() focuses an
 * existing options tab.
 */

export type Message =
  /** Restore default settings (options page -> service worker) */
  | {message: 'restoreDefaults'}
  /** Show the screensaver now (options page -> service worker) */
  | {message: 'showScreensaver'}
  /** Close all screensaver windows (service worker -> screensavers) */
  | {message: 'closeScreensaver'}
  /** Is a screensaver showing? Any screensaver replies (service worker -> screensavers) */
  | {message: 'isScreensaverShowing'}
  /** A photo source failed to update (service worker -> options page) */
  | {message: 'photoSourceFailed'; key: string; error: string}
  /** A storage write failed for lack of space */
  | {message: 'storageExceeded'};

export type MessageType = Message['message'];

export interface Response {
  message?: string;
  error?: string;
}

/** Errors that only mean "nobody is listening" */
function isNoReceiver(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('Receiving end does not exist') || msg.includes('port closed');
}

/**
 * Send a message to the other extension contexts.
 *
 * @throws An Error if there is no receiver, or the send failed
 */
export async function send(msg: Message): Promise<Response | undefined> {
  try {
    return await chrome.runtime.sendMessage<Message, Response | undefined>(msg);
  } catch (err) {
    if (!isNoReceiver(err)) {
      console.warn(`Msg.send(${msg.message}):`, err);
    }
    throw err;
  }
}

/** Send a message and ignore any failure, including no receiver. */
export function broadcast(msg: Message): void {
  send(msg).catch(() => {});
}

export type Handler = (
  msg: Message,
  sender: chrome.runtime.MessageSender,
) => Promise<Response> | Response | undefined;

/**
 * Listen for messages. The handler returns a Response (or a promise of one)
 * to reply, or undefined to leave the message for another listener.
 */
export function listen(handler: Handler): () => void {
  const listener = (
    msg: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: Response) => void,
  ): boolean => {
    let result: ReturnType<Handler>;
    try {
      result = handler(msg, sender);
    } catch (err) {
      sendResponse({error: err instanceof Error ? err.message : String(err)});
      return false;
    }
    if (result === undefined) {
      return false;
    }
    if (result instanceof Promise) {
      result.then(sendResponse, (err: unknown) => {
        sendResponse({error: err instanceof Error ? err.message : String(err)});
      });
      return true;
    }
    sendResponse(result);
    return false;
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}
