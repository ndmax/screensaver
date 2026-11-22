/**
 * Face detection for pan and scan.
 *
 * Replaces face-api.js 0.19 (abandoned 2020) with MediaPipe's BlazeFace
 * detector. The library and its ~15MB WebAssembly runtime are only loaded
 * when face detection is turned on.
 */

import type {FaceDetector} from '@mediapipe/tasks-vision';

/** A face bounding box in the image's natural pixel coordinates */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const WASM_PATH = 'mediapipe/wasm';
const MODEL_PATH = 'models/blaze_face_short_range.tflite';

let detector: Promise<FaceDetector> | null = null;

/**
 * Load the detector. Safe to call repeatedly.
 *
 * @throws An Error if the runtime or model fails to load
 */
export function initialize(): Promise<FaceDetector> {
  detector ??= (async () => {
    const {FaceDetector, FilesetResolver} = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(chrome.runtime.getURL(WASM_PATH));
    return FaceDetector.createFromOptions(fileset, {
      baseOptions: {modelAssetPath: chrome.runtime.getURL(MODEL_PATH), delegate: 'CPU'},
      runningMode: 'IMAGE',
    });
  })();
  detector.catch(() => {
    // allow a retry on the next call
    detector = null;
  });
  return detector;
}

/**
 * Detect faces in a loaded image. The image must be same-origin or loaded
 * with CORS, or the pixels can't be read.
 *
 * @returns face boxes, empty on failure
 */
export async function detectAll(img: HTMLImageElement): Promise<Box[]> {
  try {
    const d = await initialize();
    const result = d.detect(img);
    return result.detections
        .map((det) => det.boundingBox)
        .filter((b): b is NonNullable<typeof b> => !!b)
        .map((b) => ({left: b.originX, top: b.originY, right: b.originX + b.width, bottom: b.originY + b.height}));
  } catch (err) {
    console.warn('FaceDetect.detectAll:', err);
    return [];
  }
}
