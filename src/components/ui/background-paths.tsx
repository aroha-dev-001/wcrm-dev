'use client';

import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

// The artwork lives in this coordinate space and is fitted to the canvas
// the way an SVG viewBox with preserveAspectRatio="xMidYMid meet" would
// be. Lines run well past it, so they keep filling tall or wide boxes.
const VIEW_W = 696;
const VIEW_H = 316;
const LINES_PER_LAYER = 36;
// Share of each line lit by its travelling streak.
const STREAK = 0.4;
// How far the layers lean toward the pointer at the edge of the window.
const SHIFT_X = 40;
const SHIFT_Y = 24;
const TILT_DEG = 2;
// Seconds for the lean to close most of the gap to the pointer.
const EASE_S = 0.35;
const FALLBACK_COLOR = '#f4f4f5';

type Layer = 1 | -1;
type Point = [number, number];

interface Line {
  layer: Layer;
  path: Path2D;
  length: number;
  width: number;
  alpha: number;
  /** Seconds for the streak to travel the whole line once. */
  period: number;
  /** Where in its loop the line starts, 0..1. */
  phase: number;
}

function cubicLength(p0: Point, p1: Point, p2: Point, p3: Point) {
  let length = 0;
  let [px, py] = p0;
  for (let step = 1; step <= 48; step++) {
    const t = step / 48;
    const u = 1 - t;
    const x =
      u * u * u * p0[0] +
      3 * u * u * t * p1[0] +
      3 * u * t * t * p2[0] +
      t * t * t * p3[0];
    const y =
      u * u * u * p0[1] +
      3 * u * u * t * p1[1] +
      3 * u * t * t * p2[1] +
      t * t * t * p3[1];
    length += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return length;
}

// Path2D only exists in the browser, so this runs on mount, not at import.
function buildLines(): Line[] {
  const lines: Line[] = [];
  for (const layer of [1, -1] as const) {
    for (let i = 0; i < LINES_PER_LAYER; i++) {
      const k = i * 5 * layer;
      const j = i * 6;
      const start: Point = [-(380 - k), -(189 + j)];
      const c1: Point = [-(312 - k), 216 - j];
      const mid: Point = [152 - k, 343 - j];
      const c2: Point = [616 - k, 470 - j];
      const end: Point = [684 - k, 875 - j];
      lines.push({
        layer,
        path: new Path2D(`M${start}C${start} ${c1} ${mid}C${c2} ${end} ${end}`),
        length:
          cubicLength(start, start, c1, mid) + cubicLength(mid, c2, end, end),
        width: 0.5 + i * 0.03,
        alpha: Math.min(1, 0.1 + i * 0.03),
        // Spread speeds and starting points so no two lines move in step.
        period: 12 + ((i * 7) % 10) * 0.8,
        phase: (((i * 3) % 10) + (layer === 1 ? 0 : 0.5)) / 10,
      });
    }
  }
  return lines;
}

/**
 * Two layers of flowing lines, each lit by a streak that travels along
 * it, leaning toward the pointer — the layers in opposite directions,
 * so the pair reads as depth. Drawn on one canvas in a single pass per
 * frame. Uses the element's `color`; set colour and strength with
 * `text-*` / `opacity-*` on `className`. Fills its nearest positioned
 * ancestor, so give the content above it `relative`. Decorative and
 * never takes pointer events; stops drawing while off-screen, and holds
 * still under reduced motion.
 */
export function BackgroundPaths({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const lines = buildLines();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0;
    let height = 0;
    let dpr = 1;
    let color = FALLBACK_COLOR;
    let time = 0;
    let lastFrame = 0;
    let frame = 0;
    let onScreen = false;
    // Pointer target and the eased value that trails it, -1..1 per axis.
    const target = { x: 0, y: 0 };
    const lean = { x: 0, y: 0 };

    const draw = () => {
      if (!width || !height) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const scale = Math.min(width / VIEW_W, height / VIEW_H);
      const offsetX = (width - VIEW_W * scale) / 2;
      const offsetY = (height - VIEW_H * scale) / 2;
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';

      for (const layer of [1, -1] as const) {
        ctx.save();
        ctx.translate(
          width / 2 + lean.x * SHIFT_X * layer,
          height / 2 + lean.y * SHIFT_Y * layer
        );
        ctx.rotate((lean.x * TILT_DEG * layer * Math.PI) / 180);
        ctx.translate(offsetX - width / 2, offsetY - height / 2);
        ctx.scale(scale, scale);
        for (const line of lines) {
          if (line.layer !== layer) continue;
          const loop = time / line.period + line.phase;
          // Dash + gap span exactly one line length, so the streak leaving
          // the end is the same one re-entering at the start: no seam.
          ctx.setLineDash([line.length * STREAK, line.length * (1 - STREAK)]);
          ctx.lineDashOffset = -(loop % 1) * line.length;
          // Each line breathes between 30% and 60% of its strength.
          ctx.globalAlpha =
            line.alpha * (0.45 + 0.15 * Math.sin(loop * 2 * Math.PI));
          ctx.lineWidth = line.width;
          ctx.stroke(line.path);
        }
        ctx.restore();
      }
    };

    const tick = (now: number) => {
      // Cap the step so a stalled tab resumes where it left off.
      const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.1) : 0;
      lastFrame = now;
      time += dt;
      const follow = 1 - Math.exp(-dt / EASE_S);
      lean.x += (target.x - lean.x) * follow;
      lean.y += (target.y - lean.y) * follow;
      draw();
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (frame || !onScreen || reducedMotion.matches) return;
      lastFrame = 0;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      // Canvas may not parse every CSS colour syntax (lab(), oklch());
      // an unparsed value leaves the sentinel in place.
      ctx.strokeStyle = '#010203';
      ctx.strokeStyle = getComputedStyle(canvas).color;
      color = ctx.strokeStyle === '#010203' ? FALLBACK_COLOR : ctx.strokeStyle;
      draw();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (reducedMotion.matches) return;
      target.x = (event.clientX / window.innerWidth) * 2 - 1;
      target.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    const onPointerLeave = () => {
      target.x = 0;
      target.y = 0;
    };
    const onMotionPreference = () => {
      stop();
      target.x = target.y = lean.x = lean.y = 0;
      draw();
      start();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    // display:none (below lg) and scrolled-away both count as off-screen.
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) start();
      else stop();
    });
    intersectionObserver.observe(canvas);
    const root = document.documentElement;
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    root.addEventListener('pointerleave', onPointerLeave);
    reducedMotion.addEventListener('change', onMotionPreference);

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerleave', onPointerLeave);
      reducedMotion.removeEventListener('change', onMotionPreference);
    };
  }, []);

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        className
      )}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
