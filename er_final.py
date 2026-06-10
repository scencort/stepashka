#!/usr/bin/env python3
"""Clean ER diagram – only structural edges, no messy routing."""

TW  = 215   # table width
RH  = 27    # row height
HH  = 34    # header height
PAD = 8

def th(fields): return HH + len(fields) * RH + PAD

# Col / Row grid
C0, C1, C2, C3 = 40, 290, 540, 790
R0, R1, R2, R3 = 70, 310, 540, 760

TABLES = {
    "users":          (C0, R0, "#2563eb", ["PK id","   email","   full_name","   role","   status"]),
    "courses":        (C1, R0, "#dc2626", ["PK id","   title","   level","FK teacher_id","   status","   price_cents"]),
    "course_modules": (C1, R1, "#dc2626", ["PK id","FK course_id","   title","   module_order"]),
    "lessons":        (C1, R2, "#dc2626", ["PK id","FK module_id","   title","   lesson_type"]),
    "course_steps":   (C1, R3, "#7c3aed", ["PK id","FK course_id","FK lesson_id","   step_type","   xp"]),
    "enrollments":    (C2, R0, "#15803d", ["PK id","FK user_id","FK course_id","   status","   progress_%"]),
    "assignments":    (C2, R1, "#7c3aed", ["PK id","FK lesson_id","   title","   assignment_type","   max_score"]),
    "submissions":    (C2, R2, "#7c3aed", ["PK id","FK user_id","FK assignment_id","   score","   status"]),
    "certificates":   (C3, R0, "#d97706", ["PK id","FK user_id","FK course_id","   cert_code","   issued_at"]),
    "payments":       (C3, R1, "#0891b2", ["PK id","FK user_id","FK course_id","   amount_cents","   status"]),
}

W, H = 1060, 1000

# ── Only 7 clean structural connections ────────────────────────────────────
# Each is a list of (x,y) waypoints — strictly horizontal then vertical (or reverse)

def mid_right(name):
    x, y, c, f = TABLES[name]
    return (x + TW, y + HH // 2)

def mid_left(name):
    x, y, c, f = TABLES[name]
    return (x, y + HH // 2)

def mid_bottom(name):
    x, y, c, f = TABLES[name]
    return (x + TW // 2, y + th(f))

def mid_top(name):
    x, y, c, f = TABLES[name]
    return (x + TW // 2, y)

def elbow_h(p1, p2):
    """Horizontal first, then vertical."""
    return [p1, (p2[0], p1[1]), p2]

def elbow_v(p1, p2):
    """Vertical first, then horizontal."""
    return [p1, (p1[0], p2[1]), p2]

CONNS = [
    # 1. users → courses  (horizontal, same row)
    ([mid_right("users"), mid_left("courses")],
     "преподаёт"),

    # 2. courses → enrollments  (horizontal, same row)
    ([mid_right("courses"), mid_left("enrollments")],
     ""),

    # 3. courses → course_modules  (vertical, same column)
    ([mid_bottom("courses"), mid_top("course_modules")],
     ""),

    # 4. course_modules → lessons  (vertical, same column)
    ([mid_bottom("course_modules"), mid_top("lessons")],
     ""),

    # 5. lessons → course_steps  (vertical, same column)
    ([mid_bottom("lessons"), mid_top("course_steps")],
     ""),

    # 6. lessons → assignments  (right of lessons → left of assignments, one elbow)
    (elbow_h(mid_right("lessons"), mid_left("assignments")),
     ""),

    # 7. assignments → submissions  (vertical, same column)
    ([mid_bottom("assignments"), mid_top("submissions")],
     ""),
]

# ── SVG builder ────────────────────────────────────────────────────────────
def polyline(pts, color="#94a3b8"):
    s = " ".join(f"{x:.0f},{y:.0f}" for x, y in pts)
    return (f'<polyline points="{s}" fill="none" stroke="{color}" '
            f'stroke-width="2" marker-end="url(#arrow)"/>')

def build():
    o = []
    o.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
             f'style="background:#ffffff;font-family:\'Segoe UI\',Arial,sans-serif;">')

    # defs
    o.append('<defs>')
    o.append('<marker id="arrow" markerWidth="9" markerHeight="6" '
             'refX="8.5" refY="3" orient="auto">'
             '<polygon points="0,0 9,3 0,6" fill="#64748b"/></marker>')
    for name, (x,y,c,_) in TABLES.items():
        o.append(f'<linearGradient id="hdr_{name}" x1="0" y1="0" x2="1" y2="0">'
                 f'<stop offset="0%" stop-color="{c}"/>'
                 f'<stop offset="100%" stop-color="{c}bb"/></linearGradient>')
    o.append('</defs>')

    # column panels
    panels = [
        (C0-12, TW+24,  "#eff6ff", "#2563eb",  "Пользователи"),
        (C1-12, TW+24,  "#fff1f2", "#dc2626",  "Учебный контент"),
        (C2-12, TW+24,  "#f0fdf4", "#15803d",  "Прогресс / Задания"),
        (C3-12, TW+24,  "#fffbeb", "#d97706",  "Результаты"),
    ]
    for px, pw, fill, col, label in panels:
        o.append(f'<rect x="{px}" y="14" width="{pw}" height="{H-28}" '
                 f'rx="12" fill="{fill}" stroke="{col}44" stroke-width="1.5"/>')
        o.append(f'<text x="{px+pw//2}" y="34" text-anchor="middle" '
                 f'font-size="13" font-weight="700" fill="{col}">{label}</text>')

    # connections (behind tables)
    for pts, label in CONNS:
        o.append(polyline(pts))
        if label:
            mx = (pts[0][0] + pts[-1][0]) // 2
            my = (pts[0][1] + pts[-1][1]) // 2
            o.append(f'<rect x="{mx-28}" y="{my-10}" width="56" height="14" '
                     f'rx="4" fill="white" opacity="0.85"/>')
            o.append(f'<text x="{mx}" y="{my+1}" text-anchor="middle" '
                     f'font-size="10" fill="#475569">{label}</text>')

    # tables
    for name, (x, y, c, fields) in TABLES.items():
        h = th(fields)

        o.append(f'<rect x="{x+3}" y="{y+3}" width="{TW}" height="{h}" '
                 f'rx="8" fill="#00000015"/>')
        o.append(f'<rect x="{x}" y="{y}" width="{TW}" height="{h}" '
                 f'rx="8" fill="white" stroke="{c}55" stroke-width="1.5"/>')
        # header
        o.append(f'<rect x="{x}" y="{y}" width="{TW}" height="{HH}" '
                 f'rx="8" fill="url(#hdr_{name})"/>')
        o.append(f'<rect x="{x}" y="{y+16}" width="{TW}" height="{HH-16}" fill="{c}cc"/>')
        o.append(f'<text x="{x+TW//2}" y="{y+HH-8}" text-anchor="middle" '
                 f'font-size="14" font-weight="800" fill="white">{name}</text>')
        o.append(f'<line x1="{x}" y1="{y+HH}" x2="{x+TW}" y2="{y+HH}" '
                 f'stroke="{c}44" stroke-width="1"/>')

        for i, f in enumerate(fields):
            fy  = y + HH + i * RH
            cy2 = fy + RH // 2 + 5
            is_pk = f.startswith("PK")
            is_fk = f.startswith("FK")
            label = f[3:].strip()

            if i % 2 == 0:
                o.append(f'<rect x="{x+1}" y="{fy}" width="{TW-2}" height="{RH}" fill="{c}08"/>')
            if i > 0:
                o.append(f'<line x1="{x+10}" y1="{fy}" x2="{x+TW-10}" y2="{fy}" '
                         f'stroke="#e2e8f0" stroke-width="1"/>')

            if is_pk:
                o.append(f'<rect x="{x+8}" y="{cy2-10}" width="22" height="14" rx="3" '
                         f'fill="#fef9c3" stroke="#eab308" stroke-width="1"/>')
                o.append(f'<text x="{x+19}" y="{cy2}" text-anchor="middle" '
                         f'font-size="8" font-weight="900" fill="#ca8a04">PK</text>')
                o.append(f'<text x="{x+36}" y="{cy2}" font-size="13" font-weight="700" fill="#0f172a">{label}</text>')
            elif is_fk:
                o.append(f'<rect x="{x+8}" y="{cy2-10}" width="22" height="14" rx="3" '
                         f'fill="#ede9fe" stroke="#8b5cf6" stroke-width="1"/>')
                o.append(f'<text x="{x+19}" y="{cy2}" text-anchor="middle" '
                         f'font-size="8" font-weight="900" fill="#7c3aed">FK</text>')
                o.append(f'<text x="{x+36}" y="{cy2}" font-size="13" fill="#6d28d9" font-style="italic">{label}</text>')
            else:
                o.append(f'<text x="{x+14}" y="{cy2}" font-size="13" fill="#334155">{label}</text>')

        o.append(f'<rect x="{x+1}" y="{y+h-3}" width="{TW-2}" height="3" rx="3" fill="{c}77"/>')

    # legend
    BW, BH = 30, 20   # badge width/height
    leg_h = 44
    leg_w = 390
    lx = (W - leg_w) // 2
    ly = H - 58
    by = ly + leg_h // 2   # vertical center of legend box

    o.append(f'<rect x="{lx}" y="{ly}" width="{leg_w}" height="{leg_h}" rx="10" '
             f'fill="white" stroke="#cbd5e1" stroke-width="1.5"/>')

    # item 1: PK
    x1 = lx + 18
    o.append(f'<rect x="{x1}" y="{by-BH//2}" width="{BW}" height="{BH}" rx="4" '
             f'fill="#fef9c3" stroke="#eab308" stroke-width="1.5"/>')
    o.append(f'<text x="{x1+BW//2}" y="{by}" text-anchor="middle" dominant-baseline="central" '
             f'font-size="9" font-weight="900" fill="#ca8a04">PK</text>')
    o.append(f'<text x="{x1+BW+8}" y="{by}" dominant-baseline="central" '
             f'font-size="13" font-weight="600" fill="#ca8a04">Primary Key</text>')

    # item 2: FK
    x2 = lx + 168
    o.append(f'<rect x="{x2}" y="{by-BH//2}" width="{BW}" height="{BH}" rx="4" '
             f'fill="#ede9fe" stroke="#8b5cf6" stroke-width="1.5"/>')
    o.append(f'<text x="{x2+BW//2}" y="{by}" text-anchor="middle" dominant-baseline="central" '
             f'font-size="9" font-weight="900" fill="#7c3aed">FK</text>')
    o.append(f'<text x="{x2+BW+8}" y="{by}" dominant-baseline="central" '
             f'font-size="13" font-weight="600" fill="#7c3aed">Foreign Key</text>')

    # item 3: arrow
    x3 = lx + 310
    o.append(f'<line x1="{x3}" y1="{by}" x2="{x3+24}" y2="{by}" '
             f'stroke="#64748b" stroke-width="2"/>')
    o.append(f'<polygon points="{x3+18},{by-5} {x3+28},{by} {x3+18},{by+5}" fill="#64748b"/>')
    o.append(f'<text x="{x3+34}" y="{by}" dominant-baseline="central" '
             f'font-size="13" font-weight="600" fill="#64748b">связь</text>')

    # subtitle
    o.append(f'<text x="{W//2}" y="{H-8}" text-anchor="middle" dominant-baseline="central" '
             f'font-size="11" fill="#94a3b8">Gradus EdTech — ER-диаграмма базы данных</text>')
    o.append('</svg>')
    return '\n'.join(o)

svg = build()
with open(r"C:\Users\yaros\Desktop\stepashka\er_final.svg", "w", encoding="utf-8") as f:
    f.write(svg)
print(f"Done {len(svg)//1024}KB")
