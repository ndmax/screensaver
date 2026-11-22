/**
 * Face detection for pan and scan, with MediaPipe's BlazeFace full-range
 * detector. The library and its ~15MB WebAssembly runtime are only loaded
 * when face detection is turned on.
 *
 * The short-range model only finds faces that fill much of the frame
 * (selfies). The full-range model, run on the whole photo and on
 * overlapping quarters (face_tiles.ts), finds faces down to a few percent of
 * the photo's width.
 */

import type {FaceDetector} from '@mediapipe/tasks-vision';
import {type Box, mergeBoxes, tiles} from './face_tiles';

const WASM_PATH = 'mediapipe/wasm';
const MODEL_PATH = 'models/blaze_face_full_range.tflite';
/** Tiles are drawn at most this size (longest side, px) for the detector */
const MAX_TILE_PX = 1024;

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
    const boxes: Box[] = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    for (const [i, tile] of tiles(img.naturalWidth, img.naturalHeight).entries()) {
      let source: HTMLImageElement | HTMLCanvasElement = img;
      let scale = 1;
      if (i > 0) {
        if (!ctx) {
          break;
        }
        scale = Math.min(1, MAX_TILE_PX / Math.max(tile.width, tile.height));
        canvas.width = Math.round(tile.width * scale);
        canvas.height = Math.round(tile.height * scale);
        ctx.drawImage(img, tile.x, tile.y, tile.width, tile.height, 0, 0, canvas.width, canvas.height);
        source = canvas;
      }
      for (const det of d.detect(source).detections) {
        const b = det.boundingBox;
        if (b) {
          boxes.push({
            left: tile.x + b.originX / scale,
            top: tile.y + b.originY / scale,
            right: tile.x + (b.originX + b.width) / scale,
            bottom: tile.y + (b.originY + b.height) / scale,
          });
        }
      }
    }
    return mergeBoxes(boxes);
  } catch (err) {
    console.warn('FaceDetect.detectAll:', err);
    return [];
  }
}
