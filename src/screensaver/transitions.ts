/**
 * Slide entry/exit animations.
 *
 * Replaces neon-animation's named animations (and the custom spin-up /
 * spin-down animations) with Web Animations API keyframes.
 */

import {TRANS_TYPE, type TransType} from '../lib/settings';

export interface Transition {
  entry: Keyframe[];
  exit: Keyframe[];
  /** ms */
  duration: number;
}

const FADE_IN: Keyframe[] = [{opacity: 0}, {opacity: 1}];
const FADE_OUT: Keyframe[] = [{opacity: 1}, {opacity: 0}];
const SCALE_UP: Keyframe[] = [{transform: 'scale(0)'}, {transform: 'scale(1)'}];
const SCALE_DOWN: Keyframe[] = [{transform: 'scale(1)'}, {transform: 'scale(0)'}];
const FROM_RIGHT: Keyframe[] = [{transform: 'translateX(100%)'}, {transform: 'none'}];
const FROM_LEFT: Keyframe[] = [{transform: 'translateX(-100%)'}, {transform: 'none'}];
const FROM_TOP: Keyframe[] = [{transform: 'translateY(-100%)'}, {transform: 'translateY(0%)'}];
const FROM_BOTTOM: Keyframe[] = [{transform: 'translateY(100%)'}, {transform: 'translateY(0%)'}];
const TO_LEFT: Keyframe[] = [{transform: 'none'}, {transform: 'translateX(-100%)'}];
const TO_TOP: Keyframe[] = [{transform: 'translateY(0%)'}, {transform: 'translateY(-100%)'}];
const TO_BOTTOM: Keyframe[] = [{transform: 'translateY(0%)'}, {transform: 'translateY(100%)'}];
const SPIN_UP: Keyframe[] = [{transform: 'scale(0) rotate(0)'}, {transform: 'scale(1) rotate(1.0turn)'}];
const SPIN_DOWN: Keyframe[] = [{transform: 'scale(1) rotate(1.0turn)'}, {transform: 'scale(0) rotate(0)'}];

/**
 * The animations for a transition type. Same pairings as the original
 * (including Slide right exiting to the left).
 */
export function getTransition(type: TransType): Transition {
  switch (type) {
    case TRANS_TYPE.SCALE_UP:
      return {entry: SCALE_UP, exit: SCALE_DOWN, duration: 2000};
    case TRANS_TYPE.SLIDE_FROM_RIGHT:
      return {entry: FROM_RIGHT, exit: TO_LEFT, duration: 2000};
    case TRANS_TYPE.SLIDE_DOWN:
      return {entry: FROM_TOP, exit: TO_TOP, duration: 2000};
    case TRANS_TYPE.SPIN_UP:
      return {entry: SPIN_UP, exit: SPIN_DOWN, duration: 3000};
    case TRANS_TYPE.SLIDE_UP:
      return {entry: FROM_BOTTOM, exit: TO_BOTTOM, duration: 2000};
    case TRANS_TYPE.SLIDE_FROM_BOTTOM:
      return {entry: FROM_BOTTOM, exit: TO_TOP, duration: 2000};
    case TRANS_TYPE.SLIDE_RIGHT:
      return {entry: FROM_LEFT, exit: TO_LEFT, duration: 2000};
    case TRANS_TYPE.FADE:
    default:
      return {entry: FADE_IN, exit: FADE_OUT, duration: 2000};
  }
}
