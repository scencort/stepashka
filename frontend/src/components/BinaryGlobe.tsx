import { useEffect, useRef } from "react";

type Point = {
  x: number;
  y: number;
  z: number;
  /** index into the palette for stable per-point color */
  tone: number;
  /** subtle per-point twinkle phase */
  phase: number;
};

type Pulse = {
  x: number;
  y: number;
  z: number;
  life: number;
  maxLife: number;
};

interface Props {
  size?: number;
  pointCount?: number;
  className?: string;
  /** Palette of dot colors. First entry is used for front-most highlights and the halo. */
  palette?: string[];
  /** Color for the pulsing rings (active "students") */
  pulseColor?: string;
}

/**
 * 3D-globe rendered on canvas as a cloud of dots in the site's red/burgundy palette.
 * Pure canvas2D — no 3D library — manual sphere projection + depth-driven color/size.
 */
export default function BinaryGlobe({
  size = 480,
  pointCount = 1100,
  className = "",
  palette = ["#DC2626", "#F83B3B", "#C42020", "#7C1D1D", "#FFA3A3"],
  pulseColor = "#FF6B6B",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    // Generate points on unit sphere using Fibonacci spiral
    const points: Point[] = [];
    const phi = Math.PI * (Math.sqrt(5) - 1);
    for (let i = 0; i < pointCount; i++) {
      const y = 1 - (i / (pointCount - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = phi * i;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      points.push({
        x,
        y,
        z,
        tone: Math.floor(Math.random() * palette.length),
        phase: Math.random() * Math.PI * 2,
      });
    }

    let pulses: Pulse[] = [];
    const spawnPulse = () => {
      const p = points[Math.floor(Math.random() * points.length)];
      pulses.push({
        x: p.x,
        y: p.y,
        z: p.z,
        life: 0,
        maxLife: 60 + Math.random() * 40,
      });
    };

    let raf = 0;
    let rotY = 0;
    let frame = 0;
    const radius = size * 0.42;
    const cx = size / 2;
    const cy = size / 2;

    // Append alpha as 2-hex-digits to a "#RRGGBB" color
    const withAlpha = (hex: string, a: number) => {
      const aa = Math.max(0, Math.min(255, Math.round(a * 255)))
        .toString(16)
        .padStart(2, "0");
      return `${hex}${aa}`;
    };

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      // Soft outer glow (red-tinted halo)
      const glow = ctx.createRadialGradient(
        cx,
        cy,
        radius * 0.15,
        cx,
        cy,
        radius * 1.55,
      );
      glow.addColorStop(0, withAlpha(palette[0], 0.18));
      glow.addColorStop(0.5, withAlpha(palette[0], 0.08));
      glow.addColorStop(1, withAlpha(palette[0], 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.55, 0, Math.PI * 2);
      ctx.fill();

      // Inner subtle disc
      ctx.fillStyle = withAlpha(palette[3] || palette[0], 0.05);
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.99, 0, Math.PI * 2);
      ctx.fill();

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const xTilt = Math.sin(rotY * 0.35) * 0.22;
      const cosX = Math.cos(xTilt);
      const sinX = Math.sin(xTilt);

      // Spawn pulses occasionally (max 4 simultaneously)
      if (frame % 28 === 0 && pulses.length < 4) spawnPulse();

      const t = frame * 0.04;

      for (const p of points) {
        // Rotate around Y
        const x1 = p.x * cosY + p.z * sinY;
        const z1 = -p.x * sinY + p.z * cosY;
        // Tilt around X
        const y1 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;

        const sx = cx + x1 * radius;
        const sy = cy + y1 * radius;
        const depth = (z2 + 1) / 2; // 0 (back) → 1 (front)

        if (depth < 0.16) continue;

        const fade = Math.pow(depth, 1.6);
        // Subtle twinkle so the globe feels alive
        const twinkle = 0.85 + 0.15 * Math.sin(t + p.phase);
        const alpha = (0.18 + fade * 0.82) * twinkle;

        // Front-most points always use the brightest palette entry; others their stable tone
        const colorIdx =
          depth > 0.85 ? 0 : Math.min(palette.length - 1, p.tone);
        const baseColor = palette[colorIdx];

        // Dot size scales with depth
        const r = 0.7 + fade * 1.7;

        ctx.fillStyle = withAlpha(baseColor, alpha);
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();

        // Soft halo on the very front-facing dots
        if (depth > 0.9) {
          ctx.fillStyle = withAlpha(palette[0], 0.18 * fade);
          ctx.beginPath();
          ctx.arc(sx, sy, r * 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Pulses (drawn on top, only on front hemisphere)
      const newPulses: Pulse[] = [];
      for (const pulse of pulses) {
        pulse.life += 1;
        if (pulse.life >= pulse.maxLife) continue;

        const x1 = pulse.x * cosY + pulse.z * sinY;
        const z1 = -pulse.x * sinY + pulse.z * cosY;
        const y1 = pulse.y * cosX - z1 * sinX;
        const z2 = pulse.y * sinX + z1 * cosX;
        const depth = (z2 + 1) / 2;

        if (depth > 0.5) {
          const k = pulse.life / pulse.maxLife;
          const sx = cx + x1 * radius;
          const sy = cy + y1 * radius;
          const r = 2 + k * 16;
          const alpha = (1 - k) * 0.85 * Math.min(1, (depth - 0.5) * 4);

          ctx.strokeStyle = withAlpha(pulseColor, alpha);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = withAlpha(pulseColor, alpha * 0.7);
          ctx.beginPath();
          ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        newPulses.push(pulse);
      }
      pulses = newPulses;

      rotY += 0.0035;
      frame += 1;
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [size, pointCount, palette, pulseColor]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
