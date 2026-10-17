/**
 * Apple Fluid Interface Physics & Gesture Utilities (WWDC 2018 "Designing Fluid Interfaces")
 * Implements:
 * - Rubber-banding at soft boundaries: rubberband(overshoot, dimension, constant = 0.55)
 * - Momentum projection: project(initialVelocity, decelerationRate = 0.998)
 * - Parameterized Spring (damping ratio + response in seconds) with velocity handoff & interruptibility
 * - 1:1 Pointer Events tracking with grab-offset preservation and rolling velocity history
 */

export interface SpringParams {
  /** Damping ratio: 1.0 = critically damped (no bounce), ~0.8 = slight bounce for momentum gestures */
  damping: number;
  /** Response time in seconds: lower = snappier (Apple default: 0.3 - 0.4s) */
  response: number;
}

export const APPLE_SPRING_DEFAULT: SpringParams = {
  damping: 1.0,
  response: 0.38,
};

export const APPLE_SPRING_MOMENTUM: SpringParams = {
  damping: 0.8,
  response: 0.36,
};

/**
 * Apple's exact rubber-band formula from Designing Fluid Interfaces.
 * Progressively resists movement past a boundary instead of hard-stopping.
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  if (dimension <= 0 || overshoot === 0) return 0;
  const sign = overshoot < 0 ? -1 : 1;
  const abs = Math.abs(overshoot);
  return sign * ((abs * dimension * constant) / (dimension + constant * abs));
}

/**
 * Apple's exact exponential-decay momentum projection function (WWDC 2018).
 * Projects where a flicked element would naturally come to rest given release velocity (px/s).
 */
export function project(initialVelocityPxPerSec: number, decelerationRate = 0.998): number {
  return ((initialVelocityPxPerSec / 1000) * decelerationRate) / (1 - decelerationRate);
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface PointerSample {
  x: number;
  y: number;
  t: number;
}

interface ActiveCardState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rafId: number | null;
}

const elementSpringStates = new WeakMap<HTMLElement, ActiveCardState>();

function getOrCreateState(el: HTMLElement): ActiveCardState {
  let st = elementSpringStates.get(el);
  if (!st) {
    st = { x: 0, y: 0, vx: 0, vy: 0, rafId: null };
    elementSpringStates.set(el, st);
  }
  return st;
}

function applyCardTransform(el: HTMLElement, x: number, y: number): void {
  const rotateDeg = Math.max(-8, Math.min(8, x * 0.035));
  el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rotateDeg.toFixed(2)}deg)`;
}

/**
 * Animates an element from its current live presentation position & velocity
 * to (targetX, targetY) using independent X and Y springs (§3 & §4).
 * Completely interruptible: grabbing the element mid-flight cancels the rAF
 * and continues from the exact on-screen coordinates.
 */
export function animateSpring2D(
  el: HTMLElement,
  targetX: number,
  targetY: number,
  initialVx = 0,
  initialVy = 0,
  params: SpringParams = APPLE_SPRING_DEFAULT,
  onRest?: () => void,
): void {
  const st = getOrCreateState(el);
  if (st.rafId !== null) {
    cancelAnimationFrame(st.rafId);
    st.rafId = null;
  }

  if (prefersReducedMotion()) {
    st.x = targetX;
    st.y = targetY;
    st.vx = 0;
    st.vy = 0;
    el.style.transform = '';
    onRest?.();
    return;
  }

  st.vx = initialVx;
  st.vy = initialVy;

  const omega = (2 * Math.PI) / Math.max(0.08, params.response);
  const zeta = Math.max(0.1, params.damping);
  let lastTime = performance.now();

  const step = (now: number) => {
    const dt = Math.min(0.032, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;

    // Independent X spring
    const dx = st.x - targetX;
    const ax = -omega * omega * dx - 2 * zeta * omega * st.vx;
    st.vx += ax * dt;
    st.x += st.vx * dt;

    // Independent Y spring
    const dy = st.y - targetY;
    const ay = -omega * omega * dy - 2 * zeta * omega * st.vy;
    st.vy += ay * dt;
    st.y += st.vy * dt;

    const settled =
      Math.abs(st.x - targetX) < 0.4 &&
      Math.abs(st.y - targetY) < 0.4 &&
      Math.abs(st.vx) < 6 &&
      Math.abs(st.vy) < 6;

    if (settled) {
      st.x = targetX;
      st.y = targetY;
      st.vx = 0;
      st.vy = 0;
      st.rafId = null;
      if (targetX === 0 && targetY === 0) {
        el.style.transform = '';
      } else {
        applyCardTransform(el, targetX, targetY);
      }
      onRest?.();
      return;
    }

    applyCardTransform(el, st.x, st.y);
    st.rafId = requestAnimationFrame(step);
  };

  st.rafId = requestAnimationFrame(step);
}

export interface SwipeCardCallbacks {
  onTap?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

const elementCallbacks = new WeakMap<HTMLElement, SwipeCardCallbacks>();

/**
 * Attaches Apple-grade 1:1 direct manipulation, hysteresis (~10px),
 * vertical rubber-banding, and momentum projection to a flashcard element.
 */
export function bindSwipeableFlashcard(
  el: HTMLElement,
  callbacks: SwipeCardCallbacks,
  initialPointerDownEvent?: PointerEvent,
): void {
  elementCallbacks.set(el, callbacks);
  if (el.dataset.appleGestureBound === 'true') return;
  el.dataset.appleGestureBound = 'true';

  let pointerId: number | null = null;
  let grabOffsetX = 0;
  let grabOffsetY = 0;
  let startClientX = 0;
  let startClientY = 0;
  let dragging = false;
  let samples: PointerSample[] = [];

  const handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const targetTag = (e.target as HTMLElement | null)?.closest('button');
    if (targetTag && targetTag !== el) return;

    const st = getOrCreateState(el);
    // Interrupt any in-flight spring and start from live presentation coordinates (§3)
    if (st.rafId !== null) {
      cancelAnimationFrame(st.rafId);
      st.rafId = null;
    }

    pointerId = e.pointerId;
    startClientX = e.clientX;
    startClientY = e.clientY;
    grabOffsetX = e.clientX - st.x;
    grabOffsetY = e.clientY - st.y;
    dragging = false;
    samples = [{ x: st.x, y: st.y, t: performance.now() }];
    el.classList.add('is-pressing');
  };

  el.addEventListener('pointerdown', handlePointerDown);

  el.addEventListener('pointermove', (e: PointerEvent) => {
    if (pointerId !== e.pointerId) return;
    const rawDx = e.clientX - startClientX;
    const rawDy = e.clientY - startClientY;

    // 10px hysteresis threshold before committing to a drag (§10)
    if (!dragging) {
      if (Math.hypot(rawDx, rawDy) < 10) return;
      dragging = true;
      el.classList.remove('is-pressing');
      el.classList.add('is-dragging');
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if synthetic event
      }
    }

    const st = getOrCreateState(el);
    const nextX = e.clientX - grabOffsetX;
    const rawY = e.clientY - grabOffsetY;
    // Rubber-band vertical movement strongly, and horizontal movement past 160px (§9)
    const width = el.offsetWidth || 360;
    const height = el.offsetHeight || 260;
    const clampedX =
      Math.abs(nextX) <= 140
        ? nextX
        : Math.sign(nextX) * (140 + rubberband(Math.abs(nextX) - 140, width, 0.55));
    const rubberY = rubberband(rawY, height, 0.25);

    st.x = clampedX;
    st.y = rubberY;
    applyCardTransform(el, st.x, st.y);

    const now = performance.now();
    samples.push({ x: st.x, y: st.y, t: now });
    if (samples.length > 6) samples.shift();
  });

  const finishGesture = (e: PointerEvent, cancelled: boolean) => {
    if (pointerId !== e.pointerId) return;
    pointerId = null;
    el.classList.remove('is-pressing', 'is-dragging');

    const cb = elementCallbacks.get(el) || callbacks;
    const st = getOrCreateState(el);
    if (!dragging) {
      if (!cancelled) cb.onTap?.();
      return;
    }

    el.dataset.suppressClickUntil = String(performance.now() + 120);

    // Compute release velocity from recent pointer history (§2 & §5)
    let vx = 0;
    let vy = 0;
    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dtSec = Math.max(0.008, (last.t - first.t) / 1000);
      vx = (last.x - first.x) / dtSec;
      vy = (last.y - first.y) / dtSec;
    }

    // Project resting endpoint using Apple's deceleration formula (§6)
    const projectedX = st.x + project(vx, 0.994);
    const width = el.offsetWidth || 360;
    const threshold = width * 0.42;

    // Commit if projected endpoint crosses threshold AND velocity doesn't oppose direction
    if (!cancelled && projectedX < -threshold && vx <= 80 && cb.onSwipeLeft) {
      animateSpring2D(el, 0, 0, vx * 0.25, vy * 0.25, APPLE_SPRING_MOMENTUM);
      cb.onSwipeLeft();
      return;
    }

    if (!cancelled && projectedX > threshold && vx >= -80 && cb.onSwipeRight) {
      animateSpring2D(el, 0, 0, vx * 0.25, vy * 0.25, APPLE_SPRING_MOMENTUM);
      cb.onSwipeRight();
      return;
    }

    // Otherwise spring smoothly back to origin with velocity handoff (§4 & §5)
    animateSpring2D(el, 0, 0, vx, vy, APPLE_SPRING_DEFAULT);
  };

  el.addEventListener('pointerup', (e: PointerEvent) => finishGesture(e, false));
  el.addEventListener('pointercancel', (e: PointerEvent) => finishGesture(e, true));

  if (initialPointerDownEvent) {
    handlePointerDown(initialPointerDownEvent);
  }
}
