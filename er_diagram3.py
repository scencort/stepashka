#!/usr/bin/env python3
"""Clean ER diagram — hand-routed connections, strict grid layout."""

TW = 200   # table width
RH = 28    # row height
HH = 36    # header height
PAD = 6    # bottom padding inside table

def tbl_h(fields): return HH + len(fields) * RH + PAD

# ── Tables ─────────────────────────────────────────────────────────────────
TABLES = {
    "users":          { "color": "#2563eb", "fields": ["🔑 id", "  email", "  full_name", "  role", "  status"] },
    "courses":        { "color": "#dc2626", "fields": ["🔑 id", "  title", "  level", "🔗 teacher_id", "  status", "  price_cents"] },
    "course_modules": { "color": "#dc2626", "fields": ["🔑 id", "🔗 course_id", "  title", "  module_order"] },
    "lessons":        { "color": "#dc2626", "fields": ["🔑 id", "🔗 module_id", "  title", "  lesson_type"] },
    "course_steps":   { "color": "#dc2626", "fields": ["🔑 id", "🔗 course_id", "🔗 lesson_id", "  step_type", "  xp"] },
    "assignments":    { "color": "#7c3aed", "fields": ["🔑 id", "🔗 lesson_id", "  title", "  assignment_type", "  max_score"] },
    "enrollments":    { "color": "#16a34a", "fields": ["🔑 id", "🔗 user_id", "🔗 course_id", "  status", "  progress_percent"] },
    "submissions":    { "color": "#7c3aed", "fields": ["🔑 id", "🔗 user_id", "🔗 assignment_id", "  score", "  status"] },
    "certificates":   { "color": "#d97706", "fields": ["🔑 id", "🔗 user_id", "🔗 course_id", "  cert_code", "  issued_at"] },
    "payments":       { "color": "#0891b2", "fields": ["🔑 id", "🔗 user_id", "🔗 course_id", "  amount_cents", "  status"] },
}

# ── Positions (x, y) top-left ──────────────────────────────────────────────
# Grid: col0=40, col1=290, col2=540, col3=790
C0, C1, C2, C3 = 40, 280, 520, 760

POS = {
    "users":          (C0, 60),
    "courses":        (C1, 60),
    "course_modules": (C1, 310),
    "lessons":        (C1, 510),
    "course_steps":   (C1, 700),
    "assignments":    (C1, 880),
    "enrollments":    (C2, 60),
    "submissions":    (C2, 310),
    "certificates":   (C3, 60),
    "payments":       (C3, 310),
}

W, H = 1000, 1080

# ── Connection specs: (from_table, from_side, to_table, to_side, waypoints) ─
# sides: "r"=right-mid, "l"=left-mid, "b"=bottom-mid, "t"=top-mid
# waypoints: list of (x,y) intermediate points (can be empty)

def conn_pt(name, side, offset=0):
    x, y = POS[name]
    h = tbl_h(TABLES[name]["fields"])
    if side == "r": return (x + TW,      y + HH//2 + offset)
    if side == "l": return (x,            y + HH//2 + offset)
    if side == "b": return (x + TW//2 + offset, y + h)
    if side == "t": return (x + TW//2 + offset, y)

CONNS = [
    # users → courses  (teacher_id)
    ("users", "r", "courses", "l", []),
    # users → enrollments
    ("users", "r", "enrollments", "l", []),
    # users → submissions (via right edge, routed around)
    ("users", "r", "submissions", "l",
        [(C0+TW+20, 60+HH//2), (C0+TW+20, 310+HH//2)]),
    # users → certificates
    ("users", "r", "certificates", "l",
        [(C0+TW+20, 60+HH//2), (C0+TW+20, 30), (C3+TW//2, 30), (C3+TW//2, 60)]),
    # users → payments
    ("users", "r", "payments", "l",
        [(C0+TW+20, 60+HH//2), (C0+TW+20, 30), (C3+TW//2+30, 30), (C3+TW//2+30, 310)]),

    # courses → course_modules
    ("courses", "b", "course_modules", "t", []),
    # courses → enrollments
    ("courses", "r", "enrollments", "l", []),
    # courses → certificates
    ("courses", "r", "certificates", "l",
        [(C1+TW+20, 60+HH//2), (C1+TW+20, 40), (C3+100, 40), (C3+100, 60)]),
    # courses → payments
    ("courses", "r", "payments", "l",
        [(C1+TW+20, 60+HH//2), (C1+TW+20, 40), (C3+130, 40), (C3+130, 310)]),

    # course_modules → lessons
    ("course_modules", "b", "lessons", "t", []),
    # lessons → course_steps
    ("lessons", "b", "course_steps", "t", []),
    # lessons → assignments
    ("lessons", "r", "assignments", "l",
        [(C1+TW+20, 510+HH//2), (C1+TW+20, 880+HH//2)]),
    # assignments → submissions
    ("assignments", "r", "submissions", "l",
        [(C1+TW+20, 880+HH//2), (C2-20, 880+HH//2), (C2-20, 310+HH//2)]),
]

def polyline(pts, color="#94a3b8", dashed=True):
    coords = " ".join(f"{x},{y}" for x, y in pts)
    dash = 'stroke-dasharray="7,4"' if dashed else ''
    return (f'<polyline points="{coords}" fill="none" stroke="{color}" '
            f'stroke-width="2" {dash} marker-end="url(#arr)"/>')

def build():
    lines = []
    lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
                 f'style="background:#f8fafc;font-family:\'Segoe UI\',Arial,sans-serif;">')

    # ── defs ──
    lines.append('<defs>')
    lines.append(
        '<marker id="arr" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">'
        '<polygon points="0,0 10,3.5 0,7" fill="#94a3b8"/></marker>'
    )
    for name, t in TABLES.items():
        c = t["color"]
        lines.append(f'<linearGradient id="g_{name}" x1="0" y1="0" x2="1" y2="0">'
                     f'<stop offset="0%" stop-color="{c}"/>'
                     f'<stop offset="100%" stop-color="{c}bb"/></linearGradient>')
    lines.append('</defs>')

    # ── column background bands ──
    bands = [
        (C0-10,  H-100, "#dbeafe33", "#2563eb22", "Пользователи",  "#2563eb"),
        (C1-10,  H-100, "#fee2e233", "#dc262622", "Учебный контент","#dc2626"),
        (C2-10,  620,   "#dcfce733", "#16a34a22", "Прогресс",       "#16a34a"),
        (C3-10,  620,   "#fef3c733", "#d9770622", "Результаты",     "#d97706"),
    ]
    for bx, bh, fill, stroke, label, lcol in bands:
        lines.append(f'<rect x="{bx}" y="10" width="{TW+20}" height="{bh}" '
                     f'rx="14" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>')
        lines.append(f'<text x="{bx+TW//2+10}" y="30" text-anchor="middle" '
                     f'font-size="13" font-weight="700" fill="{lcol}">{label}</text>')

    # ── connection lines (drawn BEHIND tables) ──
    for src, ss, dst, ds, wps in CONNS:
        p1 = conn_pt(src, ss)
        p2 = conn_pt(dst, ds)
        pts = [p1] + wps + [p2]
        lines.append(polyline(pts))
        # dot at source
        lines.append(f'<circle cx="{p1[0]}" cy="{p1[1]}" r="4" fill="white" '
                     f'stroke="#94a3b8" stroke-width="1.5"/>')

    # ── tables ──
    for name, tbl in TABLES.items():
        if name not in POS: continue
        x, y = POS[name]
        fields = tbl["fields"]
        h = tbl_h(fields)
        c = tbl["color"]

        # shadow
        lines.append(f'<rect x="{x+3}" y="{y+3}" width="{TW}" height="{h}" '
                     f'rx="10" fill="#00000018"/>')
        # body
        lines.append(f'<rect x="{x}" y="{y}" width="{TW}" height="{h}" '
                     f'rx="10" fill="white" stroke="{c}66" stroke-width="1.5"/>')
        # header gradient
        lines.append(f'<rect x="{x}" y="{y}" width="{TW}" height="{HH}" '
                     f'rx="10" fill="url(#g_{name})"/>')
        # header square-bottom fix
        lines.append(f'<rect x="{x}" y="{y+HH-10}" width="{TW}" height="10" fill="{c}bb"/>')
        # header text
        lines.append(f'<text x="{x+TW//2}" y="{y+HH-9}" text-anchor="middle" '
                     f'font-size="14" font-weight="800" fill="white">{name}</text>')

        # divider under header
        lines.append(f'<line x1="{x}" y1="{y+HH}" x2="{x+TW}" y2="{y+HH}" '
                     f'stroke="{c}44" stroke-width="1"/>')

        # fields
        for i, fname in enumerate(fields):
            fy  = y + HH + i * RH
            cy2 = fy + RH//2 + 5
            is_pk = fname.startswith("🔑")
            is_fk = fname.startswith("🔗")
            label = fname[2:].strip()

            # stripe
            if i % 2 == 0:
                lines.append(f'<rect x="{x+1}" y="{fy}" width="{TW-2}" height="{RH}" '
                              f'fill="{c}0a"/>')
            # row divider
            if i > 0:
                lines.append(f'<line x1="{x+8}" y1="{fy}" x2="{x+TW-8}" y2="{fy}" '
                              f'stroke="#e2e8f0" stroke-width="1"/>')

            if is_pk:
                lines.append(f'<rect x="{x+8}" y="{cy2-11}" width="24" height="14" '
                              f'rx="4" fill="#fef3c7" stroke="#f59e0b" stroke-width="1"/>')
                lines.append(f'<text x="{x+20}" y="{cy2}" text-anchor="middle" '
                              f'font-size="9" font-weight="800" fill="#d97706">PK</text>')
                lines.append(f'<text x="{x+38}" y="{cy2}" font-size="13" '
                              f'font-weight="700" fill="#1e293b">{label}</text>')
            elif is_fk:
                lines.append(f'<rect x="{x+8}" y="{cy2-11}" width="24" height="14" '
                              f'rx="4" fill="#ede9fe" stroke="#7c3aed" stroke-width="1"/>')
                lines.append(f'<text x="{x+20}" y="{cy2}" text-anchor="middle" '
                              f'font-size="9" font-weight="800" fill="#6d28d9">FK</text>')
                lines.append(f'<text x="{x+38}" y="{cy2}" font-size="13" '
                              f'font-style="italic" fill="#6d28d9">{label}</text>')
            else:
                lines.append(f'<text x="{x+14}" y="{cy2}" font-size="13" fill="#475569">{label}</text>')

        # bottom accent
        lines.append(f'<rect x="{x+1}" y="{y+h-4}" width="{TW-2}" height="4" '
                     f'fill="{c}88" rx="4"/>')

    # ── Legend ──
    lx, ly = 40, H - 64
    lines.append(f'<rect x="{lx}" y="{ly}" width="560" height="44" rx="10" '
                 f'fill="white" stroke="#e2e8f0" stroke-width="1.5"/>')
    legend = [
        (lx+12,  "PK", "#fef3c7", "#f59e0b", "#d97706", "— Primary Key"),
        (lx+170, "FK", "#ede9fe", "#7c3aed", "#6d28d9", "— Foreign Key"),
        (lx+330, "",   "",        "",         "#94a3b8",  "○─ ─ ─▶  связь 1:N"),
    ]
    for ix, badge, bg, border, tc, desc in legend:
        if badge:
            lines.append(f'<rect x="{ix}" y="{ly+14}" width="24" height="14" '
                         f'rx="4" fill="{bg}" stroke="{border}" stroke-width="1"/>')
            lines.append(f'<text x="{ix+12}" y="{ly+25}" text-anchor="middle" '
                         f'font-size="9" font-weight="800" fill="{tc}">{badge}</text>')
            lines.append(f'<text x="{ix+30}" y="{ly+26}" font-size="12" fill="{tc}">{desc}</text>')
        else:
            lines.append(f'<text x="{ix}" y="{ly+26}" font-size="12" fill="{tc}">{desc}</text>')

    lines.append('</svg>')
    return '\n'.join(lines)

svg = build()
out = r"C:\Users\yaros\Desktop\stepashka\er_compact.svg"
with open(out, "w", encoding="utf-8") as f:
    f.write(svg)
print(f"Saved {len(svg)//1024}KB -> {out}")
