#!/usr/bin/env python3
"""Compact ER diagram for presentation — core tables only, big font."""

# Only key tables, only key fields
tables = {
    "users": {
        "color": "#1d4ed8",
        "icon": "👤",
        "fields": [
            ("PK", "id"),
            ("", "email"),
            ("", "full_name"),
            ("", "role"),       # student | teacher | admin
            ("", "status"),     # active | banned
        ]
    },
    "courses": {
        "color": "#b91c1c",
        "icon": "📚",
        "fields": [
            ("PK", "id"),
            ("", "title"),
            ("", "level"),
            ("FK", "teacher_id"),
            ("", "status"),
            ("", "price_cents"),
        ]
    },
    "course_modules": {
        "color": "#b91c1c",
        "icon": "📂",
        "fields": [
            ("PK", "id"),
            ("FK", "course_id"),
            ("", "title"),
            ("", "module_order"),
        ]
    },
    "lessons": {
        "color": "#b91c1c",
        "icon": "📄",
        "fields": [
            ("PK", "id"),
            ("FK", "module_id"),
            ("", "title"),
            ("", "lesson_type"),  # video|text|interactive
        ]
    },
    "course_steps": {
        "color": "#b91c1c",
        "icon": "🧩",
        "fields": [
            ("PK", "id"),
            ("FK", "course_id"),
            ("FK", "lesson_id"),
            ("", "step_type"),   # theory|quiz|code|...
            ("", "xp"),
        ]
    },
    "enrollments": {
        "color": "#15803d",
        "icon": "🎓",
        "fields": [
            ("PK", "id"),
            ("FK", "user_id"),
            ("FK", "course_id"),
            ("", "status"),
            ("", "progress_percent"),
        ]
    },
    "assignments": {
        "color": "#7e22ce",
        "icon": "📝",
        "fields": [
            ("PK", "id"),
            ("FK", "lesson_id"),
            ("", "title"),
            ("", "assignment_type"),  # code|essay|quiz
            ("", "max_score"),
        ]
    },
    "submissions": {
        "color": "#7e22ce",
        "icon": "✅",
        "fields": [
            ("PK", "id"),
            ("FK", "user_id"),
            ("FK", "assignment_id"),
            ("", "score"),
            ("", "status"),      # queued|passed|failed
        ]
    },
    "certificates": {
        "color": "#c2410c",
        "icon": "🏆",
        "fields": [
            ("PK", "id"),
            ("FK", "user_id"),
            ("FK", "course_id"),
            ("", "cert_code"),
            ("", "issued_at"),
        ]
    },
    "payments": {
        "color": "#0f766e",
        "icon": "💳",
        "fields": [
            ("PK", "id"),
            ("FK", "user_id"),
            ("FK", "course_id"),
            ("", "amount_cents"),
            ("", "status"),      # pending|paid|refunded
        ]
    },
}

# Relationships: (from, to, label)
rels = [
    ("users",          "courses",        "создаёт"),
    ("users",          "enrollments",    ""),
    ("courses",        "enrollments",    ""),
    ("courses",        "course_modules", ""),
    ("course_modules", "lessons",        ""),
    ("lessons",        "course_steps",   ""),
    ("lessons",        "assignments",    ""),
    ("users",          "submissions",    ""),
    ("assignments",    "submissions",    ""),
    ("users",          "certificates",   ""),
    ("courses",        "certificates",   ""),
    ("users",          "payments",       ""),
    ("courses",        "payments",       ""),
]

TABLE_W = 200
ROW_H   = 26
HDR_H   = 36
PAD     = 8

positions = {
    # left column — users
    "users":          (50,  80),

    # center-top — course hierarchy
    "courses":        (330, 80),
    "course_modules": (330, 340),
    "lessons":        (330, 530),
    "course_steps":   (330, 700),
    "assignments":    (330, 880),

    # center-right — student
    "enrollments":    (610, 80),
    "submissions":    (610, 340),

    # right — results
    "certificates":   (890, 80),
    "payments":       (890, 320),
}

def tbl_h(name):
    return HDR_H + len(tables[name]["fields"]) * ROW_H + PAD

W, H = 1160, 1130

def build():
    out = []
    out.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
               f'style="background:#f1f5f9;font-family:\'Segoe UI\',Arial,sans-serif;">')

    # gradient defs
    out.append('<defs>')
    for name, t in tables.items():
        c = t["color"]
        out.append(f'<linearGradient id="g_{name}" x1="0" y1="0" x2="1" y2="0">'
                   f'<stop offset="0%" stop-color="{c}"/>'
                   f'<stop offset="100%" stop-color="{c}dd"/></linearGradient>')
    # arrow marker
    out.append('<marker id="arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">'
               '<polygon points="0,0 8,3 0,6" fill="#94a3b8"/></marker>')
    out.append('</defs>')

    # background panels
    panels = [
        (20,  50, 230, H-70, "#dbeafe", "#1d4ed820", "Пользователи"),
        (300, 50, 230, H-70, "#fee2e2", "#b91c1c20", "Учебный контент"),
        (580, 50, 230, 480,  "#dcfce7", "#15803d20", "Прогресс"),
        (860, 50, 270, 470,  "#fff7ed", "#c2410c20", "Результаты"),
    ]
    for px, py, pw, ph, fill, stroke, label in panels:
        out.append(f'<rect x="{px}" y="{py}" width="{pw}" height="{ph}" '
                   f'rx="12" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
        out.append(f'<text x="{px+pw//2}" y="{py+22}" text-anchor="middle" '
                   f'font-size="13" font-weight="700" fill="{stroke[:-2]}">{label}</text>')

    # connection lines (behind tables)
    def cx(name, side):
        x, y = positions[name]
        th = tbl_h(name)
        if side == "r": return x + TABLE_W, y + HDR_H // 2
        if side == "l": return x,            y + HDR_H // 2
        if side == "b": return x + TABLE_W//2, y + th
        if side == "t": return x + TABLE_W//2, y
        return x, y

    drawn = set()
    for src, dst, label in rels:
        if src not in positions or dst not in positions: continue
        key = tuple(sorted([src, dst]))
        if key in drawn: continue
        drawn.add(key)

        sx, sy = positions[src]
        dx, dy = positions[dst]
        sth, dth = tbl_h(src), tbl_h(dst)

        # pick sides
        if abs(sx - dx) > abs(sy - dy):
            side_s = "r" if sx < dx else "l"
            side_d = "l" if sx < dx else "r"
        else:
            side_s = "b" if sy < dy else "t"
            side_d = "t" if sy < dy else "b"

        x1, y1 = cx(src, side_s)
        x2, y2 = cx(dst, side_d)

        # draw path with right-angle
        if side_s in ("r","l") and side_d in ("r","l"):
            mx = (x1 + x2) // 2
            path = f"M{x1},{y1} L{mx},{y1} L{mx},{y2} L{x2},{y2}"
        elif side_s in ("b","t") and side_d in ("b","t"):
            my = (y1 + y2) // 2
            path = f"M{x1},{y1} L{x1},{my} L{x2},{my} L{x2},{y2}"
        else:
            path = f"M{x1},{y1} L{x2},{y2}"

        out.append(f'<path d="{path}" fill="none" stroke="#94a3b8" stroke-width="1.8" '
                   f'stroke-dasharray="6,4" marker-end="url(#arr)"/>')
        # cardinality symbols — N:M style circles at each end
        out.append(f'<circle cx="{x1}" cy="{y1}" r="4" fill="white" stroke="#94a3b8" stroke-width="1.5"/>')
        out.append(f'<circle cx="{x2}" cy="{y2}" r="4" fill="#94a3b8"/>')

    # draw tables
    for name, tbl in tables.items():
        if name not in positions: continue
        x, y = positions[name]
        h = tbl_h(name)
        c = tbl["color"]
        icon = tbl["icon"]

        # drop shadow
        out.append(f'<rect x="{x+4}" y="{y+4}" width="{TABLE_W}" height="{h}" rx="10" fill="#00000020"/>')
        # body
        out.append(f'<rect x="{x}" y="{y}" width="{TABLE_W}" height="{h}" rx="10" '
                   f'fill="white" stroke="{c}88" stroke-width="2"/>')
        # header
        out.append(f'<rect x="{x}" y="{y}" width="{TABLE_W}" height="{HDR_H}" '
                   f'rx="10" fill="url(#g_{name})"/>')
        out.append(f'<rect x="{x}" y="{y+18}" width="{TABLE_W}" height="{HDR_H-18}" fill="{c}"/>')
        # header text
        out.append(f'<text x="{x+TABLE_W//2}" y="{y+24}" text-anchor="middle" '
                   f'font-size="14" font-weight="800" fill="white">{icon} {name}</text>')

        # fields
        for i, (key, fname) in enumerate(tbl["fields"]):
            fy = y + HDR_H + i * ROW_H
            # stripe
            if i % 2 == 0:
                out.append(f'<rect x="{x+1}" y="{fy}" width="{TABLE_W-2}" height="{ROW_H}" fill="{c}08"/>')
            # divider
            if i > 0:
                out.append(f'<line x1="{x+6}" y1="{fy}" x2="{x+TABLE_W-6}" y2="{fy}" '
                            f'stroke="#e2e8f0" stroke-width="1"/>')

            cy2 = fy + ROW_H//2 + 5
            if key == "PK":
                out.append(f'<text x="{x+10}" y="{cy2}" font-size="10" font-weight="900" fill="#f59e0b">🔑</text>')
                out.append(f'<text x="{x+28}" y="{cy2}" font-size="13" font-weight="700" fill="#1e293b">{fname}</text>')
            elif key == "FK":
                out.append(f'<text x="{x+10}" y="{cy2}" font-size="10" fill="#818cf8">🔗</text>')
                out.append(f'<text x="{x+28}" y="{cy2}" font-size="13" fill="#6366f1" font-style="italic">{fname}</text>')
            else:
                out.append(f'<text x="{x+14}" y="{cy2}" font-size="13" fill="#475569">{fname}</text>')

        # bottom accent bar
        out.append(f'<rect x="{x+1}" y="{y+h-4}" width="{TABLE_W-2}" height="4" '
                   f'rx="0" fill="{c}88" style="border-radius:0 0 10px 10px"/>')

    # Legend box
    lx, ly = 50, H - 80
    out.append(f'<rect x="{lx}" y="{ly}" width="460" height="52" rx="10" '
               f'fill="white" stroke="#e2e8f0" stroke-width="1.5"/>')
    items = [("🔑","PK — Primary Key","#f59e0b"), ("🔗","FK — Foreign Key","#6366f1"),
             ("○━━●","связь 1:N","#94a3b8")]
    for i,(ico,lbl,col) in enumerate(items):
        lxi = lx + 14 + i*155
        out.append(f'<text x="{lxi}" y="{ly+22}" font-size="14">{ico}</text>')
        out.append(f'<text x="{lxi+22}" y="{ly+22}" font-size="12" fill="{col}" font-weight="600">{lbl}</text>')
    out.append(f'<text x="{lx+14}" y="{ly+42}" font-size="11" fill="#94a3b8">'
               f'Gradus EdTech — ER-диаграмма (основные таблицы)</text>')

    out.append('</svg>')
    return '\n'.join(out)

svg = build()
with open(r"C:\Users\yaros\Desktop\stepashka\er_compact.svg", "w", encoding="utf-8") as f:
    f.write(svg)
print(f"Done: {len(svg)//1024}KB")
