import { useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { Home, ArrowLeft } from "lucide-react";
import BrandLogo from "../components/BrandLogo";

const NotFound = () => {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      o: number;
      decay: number;
    }> = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2 + 1,
        o: Math.random() * 0.3 + 0.05,
        decay: Math.random() * 0.002 + 0.001,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.o += Math.sin(Date.now() * p.decay) * 0.003;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 38, 38, ${Math.max(0.03, Math.min(0.35, p.o))})`;
        ctx.fill();
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(220, 38, 38, ${0.06 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-[var(--bg)] overflow-hidden flex flex-col items-center justify-center px-4">
      {/* Animated particle background */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* Glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-primary/3 rounded-full blur-[120px] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 text-center max-w-lg">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <BrandLogo iconClassName="h-10 w-10" textClassName="text-2xl font-bold font-display text-[var(--text)]" />
        </div>

        {/* 404 Number */}
        <div className="relative mb-6">
          <span className="text-[6rem] sm:text-[10rem] md:text-[12rem] font-display font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-primary via-primary/80 to-primary/20 select-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-primary/10 blur-3xl" />
          </div>
        </div>

        {/* Text */}
        <h1 className="font-display font-bold text-2xl md:text-3xl text-[var(--text)] mb-3 tracking-tight">
          Страница не найдена
        </h1>
        <p className="text-[var(--muted)] text-base md:text-lg leading-relaxed mb-10 max-w-md mx-auto">
          Похоже, эта страница была удалена, перемещена или никогда не существовала.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-primary to-burgundy-600 hover:from-primary/90 hover:to-burgundy-500 text-white font-semibold text-sm shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
          >
            <Home size={16} className="transition-transform group-hover:-translate-y-0.5" />
            На главную
          </button>
          <button
            onClick={() => navigate(-1)}
            className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--border)]/30 text-[var(--text)] font-semibold text-sm transition-all duration-300"
          >
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
            Назад
          </button>
        </div>
      </div>

      {/* Bottom decorative line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    </div>
  );
};

export default NotFound;
