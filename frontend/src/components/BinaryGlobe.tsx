import { useEffect, useRef } from "react";

const DEFAULT_PALETTE = ["#DC2626", "#F83B3B", "#C42020", "#7C1D1D", "#FFA3A3"];
const DEFAULT_PULSE_COLOR = "#FF6B6B";

type Vec3 = { x: number; y: number; z: number };

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

type Arc = {
  start: Vec3;
  end: Vec3;
  mid: Vec3;
  /** pre-sampled bezier points (in object space); projected per frame */
  samples: Vec3[];
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

/* ---------------- Land mask ---------------- */

const VIEWBOX_W = 1000;
const VIEWBOX_H = 500;

/** Hand-crafted continent polygons in a 1000×500 equirectangular viewbox. */
const CONTINENTS: Array<Array<[number, number]>> = [
  // North America (Canada + USA)
  [
    [50, 60], [120, 50], [200, 45], [275, 50], [320, 70], [330, 100],
    [325, 140], [305, 175], [285, 200], [270, 225], [240, 245], [205, 245],
    [175, 225], [150, 195], [125, 170], [100, 140], [80, 110], [60, 85],
  ],
  // Central America
  [
    [240, 235], [285, 250], [305, 270], [285, 285], [255, 275], [235, 255],
  ],
  // Greenland
  [
    [340, 30], [385, 25], [415, 50], [410, 90], [385, 115], [350, 110],
    [330, 85], [325, 55],
  ],
  // South America
  [
    [275, 275], [310, 270], [340, 290], [350, 330], [335, 370], [310, 405],
    [285, 415], [270, 400], [265, 360], [260, 320], [265, 290],
  ],
  // Iceland / British Isles
  [
    [430, 95], [455, 90], [465, 105], [450, 120], [430, 115],
  ],
  // Europe
  [
    [455, 110], [500, 90], [550, 85], [585, 105], [590, 135], [560, 160],
    [515, 165], [475, 150], [460, 130],
  ],
  // Africa
  [
    [490, 175], [535, 165], [575, 175], [605, 200], [620, 235], [615, 280],
    [595, 320], [570, 355], [540, 370], [510, 355], [490, 320], [475, 270],
    [475, 220],
  ],
  // Madagascar
  [
    [625, 320], [640, 320], [645, 345], [635, 365], [625, 360],
  ],
  // Russia / N. Asia
  [
    [590, 60], [670, 50], [760, 50], [840, 55], [905, 65], [930, 90],
    [920, 120], [890, 145], [850, 155], [800, 155], [750, 150], [700, 145],
    [650, 140], [610, 125], [595, 95],
  ],
  // Middle East
  [
    [600, 155], [640, 155], [665, 175], [665, 210], [640, 220], [610, 215],
    [595, 190],
  ],
  // China / E. Asia
  [
    [710, 150], [770, 155], [810, 165], [840, 185], [850, 215], [820, 235],
    [780, 235], [735, 215], [705, 190],
  ],
  // Japan
  [
    [850, 165], [870, 160], [880, 175], [875, 195], [860, 195], [850, 180],
  ],
  // India / S. Asia
  [
    [670, 200], [705, 200], [720, 225], [715, 260], [690, 280], [670, 265],
    [660, 235],
  ],
  // SE Asia mainland
  [
    [735, 220], [775, 225], [790, 250], [770, 270], [745, 260], [730, 240],
  ],
  // Indonesia / Philippines
  [
    [775, 260], [830, 260], [870, 280], [880, 305], [855, 320], [820, 320],
    [780, 305], [765, 285],
  ],
  // Australia
  [
    [825, 335], [870, 330], [905, 345], [920, 370], [905, 395], [870, 405],
    [830, 400], [810, 380], [810, 355],
  ],
  // New Zealand
  [
    [925, 395], [945, 395], [950, 415], [935, 425], [920, 415],
  ],
];

function pointInPoly(x: number, y: number, poly: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function isLand(mx: number, my: number): boolean {
  for (const c of CONTINENTS) {
    if (pointInPoly(mx, my, c)) return true;
  }
  return false;
}

/* ---------------- Cities ---------------- */

/** Real lat/lng coordinates of major cities — used for pulse spawn points and arc endpoints. */
const CITIES: Array<[string, number, number]> = [
  ["Moscow",         55.75,   37.62],
  ["Saint Petersburg", 59.93, 30.34],
  ["Novosibirsk",    55.04,   82.93],
  ["Yekaterinburg",  56.84,   60.61],
  ["Kyiv",           50.45,   30.52],
  ["Warsaw",         52.23,   21.01],
  ["Berlin",         52.52,   13.40],
  ["Paris",          48.86,    2.35],
  ["London",         51.51,   -0.13],
  ["Madrid",         40.42,   -3.70],
  ["Rome",           41.90,   12.50],
  ["Athens",         37.98,   23.73],
  ["Istanbul",       41.01,   28.98],
  ["Stockholm",      59.33,   18.07],
  ["Helsinki",       60.17,   24.94],
  ["Tel Aviv",       32.08,   34.78],
  ["Cairo",          30.04,   31.24],
  ["Lagos",           6.52,    3.38],
  ["Nairobi",        -1.29,   36.82],
  ["Johannesburg",  -26.20,   28.04],
  ["Cape Town",     -33.92,   18.42],
  ["Dubai",          25.20,   55.27],
  ["Riyadh",         24.71,   46.68],
  ["Tehran",         35.69,   51.39],
  ["Tashkent",       41.30,   69.24],
  ["Karachi",        24.86,   67.01],
  ["Delhi",          28.61,   77.21],
  ["Mumbai",         19.08,   72.88],
  ["Dhaka",          23.81,   90.41],
  ["Bangkok",        13.76,  100.50],
  ["Singapore",       1.35,  103.82],
  ["Kuala Lumpur",    3.14,  101.69],
  ["Jakarta",        -6.21,  106.85],
  ["Manila",         14.60,  120.98],
  ["Hong Kong",      22.32,  114.17],
  ["Hanoi",          21.03,  105.85],
  ["Shanghai",       31.23,  121.47],
  ["Beijing",        39.90,  116.40],
  ["Seoul",          37.57,  126.98],
  ["Tokyo",          35.68,  139.69],
  ["Sydney",        -33.87,  151.21],
  ["Melbourne",     -37.81,  144.96],
  ["Auckland",      -36.85,  174.76],
  ["Perth",         -31.95,  115.86],
  ["Anchorage",      61.22, -149.90],
  ["Vancouver",      49.28, -123.12],
  ["San Francisco",  37.77, -122.42],
  ["Los Angeles",    34.05, -118.24],
  ["Chicago",        41.88,  -87.63],
  ["Toronto",        43.65,  -79.38],
  ["New York",       40.71,  -74.00],
  ["Mexico City",    19.43,  -99.13],
  ["Bogota",          4.71,  -74.07],
  ["Lima",          -12.05,  -77.04],
  ["Buenos Aires",  -34.61,  -58.40],
  ["São Paulo",     -23.55,  -46.63],
  ["Rio de Janeiro",-22.91,  -43.17],
  ["Reykjavik",      64.13,  -21.94],
];

function latLngToVec3(lat: number, lng: number): Vec3 {
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  return {
    x: Math.cos(latRad) * Math.cos(lngRad),
    y: Math.sin(latRad),
    z: Math.cos(latRad) * Math.sin(lngRad),
  };
}

/* ---------------- Component ---------------- */

/**
 * 3D-globe rendered on canvas as a cloud of dots in the site's red/burgundy palette.
 * Pure canvas2D — no 3D library — manual sphere projection + depth-driven color/size.
 * Dots are constrained to land via a polygon mask, pulses spawn at major-city coords,
 * and Stripe-style arc connections travel between random city pairs.
 */
export default function BinaryGlobe({
  size = 480,
  pointCount = 1100,
  className = "",
  palette = DEFAULT_PALETTE,
  pulseColor = DEFAULT_PULSE_COLOR,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Keep palette/pulseColor in refs so parent re-renders with new array
  // identities don't tear down the animation loop.
  const paletteRef = useRef(palette);
  const pulseColorRef = useRef(pulseColor);
  useEffect(() => {
    paletteRef.current = palette;
  }, [palette]);
  useEffect(() => {
    pulseColorRef.current = pulseColor;
  }, [pulseColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Cap DPR at 1.25 — 520px globe @ dpr=2 = 1M pixels per frame, which kills FPS on busy pages.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    /* ----- Land-only dot cloud (Fibonacci spiral, oversample, filter by mask) ----- */

    const points: Point[] = [];
    const phi = Math.PI * (Math.sqrt(5) - 1);
    // Oversample candidates so we end up with ~pointCount land points.
    const candidateCount = pointCount * 4;
    for (let i = 0; i < candidateCount; i++) {
      const y = 1 - (i / (candidateCount - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = phi * i;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;

      // Sphere → equirectangular viewbox
      const lat = (Math.asin(y) * 180) / Math.PI;
      const lng = (Math.atan2(z, x) * 180) / Math.PI;
      const mapX = ((lng + 180) / 360) * VIEWBOX_W;
      const mapY = ((80 - lat) / 140) * VIEWBOX_H;
      if (mapY < 0 || mapY > VIEWBOX_H) continue;
      if (!isLand(mapX, mapY)) continue;

      points.push({
        x,
        y,
        z,
        tone: Math.floor(Math.random() * 5),
        phase: Math.random() * Math.PI * 2,
      });
    }

    /* ----- City positions (pre-computed) ----- */

    const cityVecs: Vec3[] = CITIES.map(([, lat, lng]) => latLngToVec3(lat, lng));

    let pulses: Pulse[] = [];
    let arcs: Arc[] = [];

    const ARC_STEPS = 32;
    /** Quadratic Bézier sample in 3D. */
    const bezier3 = (s: Vec3, m: Vec3, e: Vec3, tt: number): Vec3 => {
      const it = 1 - tt;
      const it2 = it * it;
      const t2 = tt * tt;
      const c = 2 * it * tt;
      return {
        x: it2 * s.x + c * m.x + t2 * e.x,
        y: it2 * s.y + c * m.y + t2 * e.y,
        z: it2 * s.z + c * m.z + t2 * e.z,
      };
    };

    const spawnCityPulse = () => {
      const v = cityVecs[Math.floor(Math.random() * cityVecs.length)];
      // life/maxLife are in seconds (time-based animation).
      pulses.push({
        x: v.x,
        y: v.y,
        z: v.z,
        life: 0,
        maxLife: 1.0 + Math.random() * 0.7,
      });

      // With moderate chance, send an arc from another city to this one.
      if (Math.random() < 0.55 && arcs.length < 4) {
        let other = v;
        for (let tries = 0; tries < 5 && other === v; tries++) {
          other = cityVecs[Math.floor(Math.random() * cityVecs.length)];
        }
        if (other === v) return;

        const sumX = v.x + other.x;
        const sumY = v.y + other.y;
        const sumZ = v.z + other.z;
        const sumLen = Math.hypot(sumX, sumY, sumZ) || 1;
        const chord = Math.hypot(v.x - other.x, v.y - other.y, v.z - other.z);
        // Lift the midpoint above the sphere; longer chord → higher arc.
        const elev = 1 + 0.22 + Math.min(chord, 2) * 0.18;

        const mid = {
          x: (sumX / sumLen) * elev,
          y: (sumY / sumLen) * elev,
          z: (sumZ / sumLen) * elev,
        };
        // Pre-sample bezier so we don't recompute curve math every frame.
        const samples: Vec3[] = new Array(ARC_STEPS + 1);
        for (let i = 0; i <= ARC_STEPS; i++) {
          samples[i] = bezier3(other, mid, v, i / ARC_STEPS);
        }
        arcs.push({
          start: other,
          end: v,
          mid,
          samples,
          life: 0,
          maxLife: 2.0 + Math.random() * 0.7, // seconds
        });
      }
    };

    let raf = 0;
    let rotY = 0;
    const radius = size * 0.42;
    const cx = size / 2;
    const cy = size / 2;
    // Fixed tilt — the globe just rotates around its own (tilted) axis,
    // no wobble. Pre-computed once.
    const xTilt = 0.28;
    const cosX = Math.cos(xTilt);
    const sinX = Math.sin(xTilt);

    const withAlpha = (hex: string, a: number) => {
      const aa = Math.max(0, Math.min(255, Math.round(a * 255)))
        .toString(16)
        .padStart(2, "0");
      return `${hex}${aa}`;
    };

    /** Rotate a 3D point by the current camera and return projected screen coords + z. */
    const project = (
      px: number,
      py: number,
      pz: number,
      cosY: number,
      sinY: number,
      cosX: number,
      sinX: number,
    ): { sx: number; sy: number; z2: number; x1: number; y1: number } => {
      const x1 = px * cosY + pz * sinY;
      const z1 = -px * sinY + pz * cosY;
      const y1 = py * cosX - z1 * sinX;
      const z2 = py * sinX + z1 * cosX;
      return { sx: cx + x1 * radius, sy: cy + y1 * radius, z2, x1, y1 };
    };

    // Pre-cached palette fill strings (avoids string concat in hot path).
    let lastT = 0;
    let pulseTimer = 0;

    const draw = (nowMs: number) => {
      // Time-based: angular velocity stays constant even if frames drop.
      const dt = lastT === 0 ? 0.016 : Math.min(0.1, (nowMs - lastT) / 1000);
      lastT = nowMs;
      // Read palette/pulseColor from refs so parent re-renders that pass new
      // array identities don't restart the animation.
      const palette = paletteRef.current;
      const pulseColor = pulseColorRef.current;
      ctx.clearRect(0, 0, size, size);

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);

      // Cadence: a city pulse roughly every 0.5s; max 5 simultaneously.
      pulseTimer += dt;
      if (pulseTimer >= 0.5 && pulses.length < 5) {
        spawnCityPulse();
        pulseTimer = 0;
      }

      const tw = nowMs * 0.0028;

      /* ----- Sphere wireframe (meridians + parallels) ----- */
      // A faint wireframe so the globe always reads as a sphere — and the
      // rotation is visible even when an empty ocean is facing the camera.

      ctx.strokeStyle = withAlpha(palette[3] || palette[0], 0.13);
      ctx.lineWidth = 0.6;

      const MERIDIANS = 8;
      const MERIDIAN_STEPS = 22;
      for (let m = 0; m < MERIDIANS; m++) {
        const lng = (m / MERIDIANS) * Math.PI * 2;
        const cosM = Math.cos(lng);
        const sinM = Math.sin(lng);
        let drawing = false;
        ctx.beginPath();
        for (let i = 0; i <= MERIDIAN_STEPS; i++) {
          const lat = -Math.PI / 2 + (i / MERIDIAN_STEPS) * Math.PI;
          const cl = Math.cos(lat);
          const px = cl * cosM;
          const py = Math.sin(lat);
          const pz = cl * sinM;
          // Rotation by camera
          const x1 = px * cosY + pz * sinY;
          const z1 = -px * sinY + pz * cosY;
          const y1 = py * cosX - z1 * sinX;
          const z2 = py * sinX + z1 * cosX;
          if (z2 < -0.08) {
            drawing = false;
            continue;
          }
          const sx = cx + x1 * radius;
          const sy = cy + y1 * radius;
          if (drawing) ctx.lineTo(sx, sy);
          else {
            ctx.moveTo(sx, sy);
            drawing = true;
          }
        }
        ctx.stroke();
      }

      const PARALLELS = 4;
      const PARALLEL_STEPS = 40;
      for (let p = 1; p < PARALLELS; p++) {
        const lat = -Math.PI / 2 + (p / PARALLELS) * Math.PI;
        const cl = Math.cos(lat);
        const sl = Math.sin(lat);
        let drawing = false;
        ctx.beginPath();
        for (let i = 0; i <= PARALLEL_STEPS; i++) {
          const lng = (i / PARALLEL_STEPS) * Math.PI * 2;
          const px = cl * Math.cos(lng);
          const py = sl;
          const pz = cl * Math.sin(lng);
          const x1 = px * cosY + pz * sinY;
          const z1 = -px * sinY + pz * cosY;
          const y1 = py * cosX - z1 * sinX;
          const z2 = py * sinX + z1 * cosX;
          if (z2 < -0.08) {
            drawing = false;
            continue;
          }
          const sx = cx + x1 * radius;
          const sy = cy + y1 * radius;
          if (drawing) ctx.lineTo(sx, sy);
          else {
            ctx.moveTo(sx, sy);
            drawing = true;
          }
        }
        ctx.stroke();
      }

      // Subtle sphere outline ring at the limb.
      ctx.strokeStyle = withAlpha(palette[0], 0.14);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 0.5, 0, Math.PI * 2);
      ctx.stroke();

      /* ----- Dots ----- */
      // Use globalAlpha + reused palette strings to avoid 1000+ string allocations/frame.
      // Use fillRect for the inner dot (faster than ctx.arc at ≤2px).

      for (let pi = 0; pi < points.length; pi++) {
        const p = points[pi];
        // inline rotation (avoid function-call overhead in hot loop)
        const x1 = p.x * cosY + p.z * sinY;
        const z1 = -p.x * sinY + p.z * cosY;
        const y1 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;
        const depth = (z2 + 1) * 0.5;
        if (depth < 0.16) continue;

        const fade = depth * depth; // cheaper than Math.pow
        const twinkle = 0.85 + 0.15 * Math.sin(tw + p.phase);
        const alpha = (0.18 + fade * 0.82) * twinkle;

        const baseColor =
          depth > 0.85 ? palette[0] : palette[Math.min(palette.length - 1, p.tone)];
        const r = 0.7 + fade * 1.7;
        const sx = cx + x1 * radius;
        const sy = cy + y1 * radius;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = baseColor;
        ctx.fillRect(sx - r, sy - r, r * 2, r * 2);

        if (depth > 0.92) {
          ctx.globalAlpha = 0.18 * fade;
          ctx.fillStyle = palette[0];
          ctx.beginPath();
          ctx.arc(sx, sy, r * 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      /* ----- Arcs (travelling pulse between two cities) -----
         Batched into a single stroke per visible chunk per arc.
         Trail uses uniform alpha (linear-gradient fading is too costly here). */

      const tailFrac = 0.42; // portion of the curve that remains visible behind the head
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      const newArcs: Arc[] = [];

      for (let ai = 0; ai < arcs.length; ai++) {
        const arc = arcs[ai];
        arc.life += dt;
        if (arc.life >= arc.maxLife) continue;
        newArcs.push(arc);

        const progress = arc.life / arc.maxLife;
        // Head reaches the destination at ~70% of life, then the trail fades.
        const headT = Math.min(1, progress / 0.7);
        const fadeOut = progress > 0.7 ? Math.max(0, 1 - (progress - 0.7) / 0.3) : 1;

        // Head index along the pre-sampled bezier.
        const headIdx = Math.min(ARC_STEPS, Math.ceil(headT * ARC_STEPS));
        const tailStart = Math.max(0, headIdx - Math.ceil(tailFrac * ARC_STEPS));

        // Project the visible portion, batched into chunks split by sphere occlusion.
        ctx.strokeStyle = withAlpha(palette[0], 0.78 * fadeOut);
        ctx.beginPath();
        let drawing = false;
        let lastX = 0;
        let lastY = 0;
        let lastZ = 0;
        let lastR2 = 0;
        for (let i = tailStart; i <= headIdx; i++) {
          const s = arc.samples[i];
          // inline projection
          const x1 = s.x * cosY + s.z * sinY;
          const z1 = -s.x * sinY + s.z * cosY;
          const y1 = s.y * cosX - z1 * sinX;
          const z2 = s.y * sinX + z1 * cosX;
          const sx = cx + x1 * radius;
          const sy = cy + y1 * radius;
          const r2 = x1 * x1 + y1 * y1;

          // Occluded: segment connecting prev→curr passes inside the silhouette
          // AND its midpoint is behind the sphere surface.
          if (drawing) {
            const midZ = (lastZ + z2) * 0.5;
            const midR2 = (lastR2 + r2) * 0.5;
            if (midR2 < 0.94 && midZ < 0.0) {
              drawing = false;
            }
          }
          if (drawing) {
            ctx.lineTo(sx, sy);
          } else {
            ctx.moveTo(sx, sy);
            drawing = true;
          }
          lastX = sx;
          lastY = sy;
          lastZ = z2;
          lastR2 = r2;
        }
        ctx.stroke();

        // Bright head dot.
        if (fadeOut > 0.05 && lastZ > -0.05) {
          ctx.globalAlpha = fadeOut;
          ctx.fillStyle = pulseColor;
          ctx.beginPath();
          ctx.arc(lastX, lastY, 2.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = fadeOut * 0.35;
          ctx.beginPath();
          ctx.arc(lastX, lastY, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      arcs = newArcs;

      /* ----- City pulses ----- */

      const newPulses: Pulse[] = [];
      for (const pulse of pulses) {
        pulse.life += dt;
        if (pulse.life >= pulse.maxLife) continue;

        const proj = project(pulse.x, pulse.y, pulse.z, cosY, sinY, cosX, sinX);
        const depth = (proj.z2 + 1) / 2;
        if (depth > 0.5) {
          const k = pulse.life / pulse.maxLife;
          const r = 2 + k * 16;
          const alpha = (1 - k) * 0.85 * Math.min(1, (depth - 0.5) * 4);

          ctx.strokeStyle = withAlpha(pulseColor, alpha);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(proj.sx, proj.sy, r, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = withAlpha(pulseColor, alpha * 0.7);
          ctx.beginPath();
          ctx.arc(proj.sx, proj.sy, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        newPulses.push(pulse);
      }
      pulses = newPulses;

      // Constant angular velocity: ~0.55 rad/sec ≈ full rotation per 11 s.
      // Time-based so frame drops don't make rotation appear to stutter.
      rotY += 0.55 * dt;
      raf = requestAnimationFrame(draw);
    };

    // Seed a couple of arcs so the globe isn't empty on first render.
    spawnCityPulse();
    spawnCityPulse();

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, pointCount]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
