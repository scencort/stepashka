// анимированная сетка частиц — фоновый эффект для hero-секции лендинга
// частицы соединяются линиями если близко друг к другу (maxLinkDistance)
// при наведении мыши частицы отталкиваются и рисуются "лучи" от курсора
// чистый canvas2D без сторонних зависимостей
import { useEffect, useRef } from "react";

interface Props {
  className?: string;
  // количество плавающих частиц
  particleCount?: number;
  // максимальное расстояние (в css-пикселях) для соединения двух частиц линией
  maxLinkDistance?: number;
  // радиус вокруг курсора — частицы в этой зоне отталкиваются и рисуются "лучи"
  cursorRadius?: number;
  // базовый hex-цвет частиц и линий (прозрачность добавляется при отрисовке)
  color?: string;
  // множитель общей прозрачности слоя (0..1)
  intensity?: number;
}

// фоновая сетка из частиц — точки соединяются линиями если близко, реагируют на курсор
// чистый canvas2D без зависимостей — достаточно обернуть в relative-контейнер
export default function ParticleNetwork({
  className = "",
  particleCount = 90,
  maxLinkDistance = 130,
  cursorRadius = 160,
  color = "#DC2626",
  intensity = 1,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = container.clientWidth || 1;
    let height = container.clientHeight || 1;

    const resize = () => {
      width = container.clientWidth || 1;
      height = container.clientHeight || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    type P = { x: number; y: number; vx: number; vy: number; r: number };
    const particles: P[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        r: 1 + Math.random() * 1.4,
      });
    }

    const cursor = { x: -9999, y: -9999, active: false };
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      // Only treat as active when cursor is over the layer
      if (cx >= -20 && cx <= width + 20 && cy >= -20 && cy <= height + 20) {
        cursor.x = cx;
        cursor.y = cy;
        cursor.active = true;
      } else {
        cursor.active = false;
      }
    };
    const onLeave = () => {
      cursor.active = false;
      cursor.x = -9999;
      cursor.y = -9999;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseout", onLeave);

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const withAlpha = (hex: string, a: number) => {
      const aa = Math.max(0, Math.min(255, Math.round(a * 255)))
        .toString(16)
        .padStart(2, "0");
      return `${hex}${aa}`;
    };

    let raf = 0;
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const dtScale = dt / 16.67;

      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        // Soft cursor repulsion
        if (cursor.active) {
          const dx = p.x - cursor.x;
          const dy = p.y - cursor.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < cursorRadius * cursorRadius && d2 > 0.5) {
            const d = Math.sqrt(d2);
            const f = (1 - d / cursorRadius) * 0.55;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
        }

        // Damping + tiny brownian noise so they keep drifting
        p.vx = p.vx * 0.96 + (Math.random() - 0.5) * 0.04;
        p.vy = p.vy * 0.96 + (Math.random() - 0.5) * 0.04;

        // Cap velocity
        const speed = Math.hypot(p.vx, p.vy);
        const maxV = 1.3;
        if (speed > maxV) {
          p.vx = (p.vx / speed) * maxV;
          p.vy = (p.vy / speed) * maxV;
        }

        p.x += p.vx * dtScale;
        p.y += p.vy * dtScale;

        // Bounce off edges
        if (p.x < 0) {
          p.x = 0;
          p.vx *= -1;
        } else if (p.x > width) {
          p.x = width;
          p.vx *= -1;
        }
        if (p.y < 0) {
          p.y = 0;
          p.vy *= -1;
        } else if (p.y > height) {
          p.y = height;
          p.vy *= -1;
        }
      }

      // Connecting lines (O(n²) but n≈90 — trivial)
      ctx.lineWidth = 1;
      const linkSq = maxLinkDistance * maxLinkDistance;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < linkSq) {
            const d = Math.sqrt(d2);
            const alpha = (1 - d / maxLinkDistance) * 0.38 * intensity;
            ctx.strokeStyle = withAlpha(color, alpha);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Cursor "rays"
      if (cursor.active) {
        const cursorSq = cursorRadius * cursorRadius;
        for (const p of particles) {
          const dx = p.x - cursor.x;
          const dy = p.y - cursor.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < cursorSq) {
            const d = Math.sqrt(d2);
            const alpha = (1 - d / cursorRadius) * 0.7 * intensity;
            ctx.strokeStyle = withAlpha(color, alpha);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(cursor.x, cursor.y);
            ctx.stroke();
          }
        }

        // Faint halo at the cursor
        const halo = ctx.createRadialGradient(
          cursor.x,
          cursor.y,
          0,
          cursor.x,
          cursor.y,
          cursorRadius * 0.9,
        );
        halo.addColorStop(0, withAlpha(color, 0.18 * intensity));
        halo.addColorStop(1, withAlpha(color, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, cursorRadius * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }

      // Particles on top
      for (const p of particles) {
        ctx.fillStyle = withAlpha(color, 0.9 * intensity);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseout", onLeave);
      ro.disconnect();
    };
  }, [particleCount, maxLinkDistance, cursorRadius, color, intensity]);

  return (
    <div ref={containerRef} className={`absolute inset-0 ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full block" aria-hidden="true" />
    </div>
  );
}
