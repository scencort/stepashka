#!/usr/bin/env python3
"""Generates ER diagram SVG for Gradus DB schema."""

tables = {
    "users": {
        "color": "#1e40af",
        "fields": [
            ("PK", "id", "SERIAL"),
            ("", "email", "TEXT UNIQUE"),
            ("", "password_hash", "TEXT"),
            ("", "full_name", "TEXT"),
            ("", "role", "student|teacher|admin"),
            ("", "status", "active|banned"),
            ("", "avatar_url", "TEXT"),
            ("", "created_at", "TIMESTAMP"),
        ]
    },
    "account_profiles": {
        "color": "#1e40af",
        "fields": [
            ("PK/FK", "user_id", "→ users.id"),
            ("", "phone", "TEXT"),
            ("", "bio", "TEXT"),
            ("", "timezone", "TEXT"),
            ("", "language", "ru|en"),
            ("", "email_notifications", "BOOLEAN"),
            ("", "two_factor_enabled", "BOOLEAN"),
            ("", "weekly_goal", "INTEGER"),
        ]
    },
    "refresh_tokens": {
        "color": "#1e40af",
        "fields": [
            ("PK", "id", "SERIAL"),
            ("FK", "user_id", "→ users.id"),
            ("", "token_hash", "TEXT"),
            ("", "expires_at", "TIMESTAMP"),
            ("", "revoked_at", "TIMESTAMP"),
            ("", "created_at", "TIMESTAMP"),
        ]
    },
    "password_reset_tokens": {
        "color": "#1e40af",
        "fields": [
            ("PK", "id", "SERIAL"),
            ("FK", "user_id", "→ users.id"),
            ("", "token_hash", "TEXT UNIQUE"),
            ("", "expires_at", "TIMESTAMP"),
            ("", "used_at", "TIMESTAMP"),
        ]
    },
    "courses": {
        "color": "#b91c1c",
        "fields": [
            ("PK", "id", "SERIAL"),
            ("", "title", "TEXT"),
            ("", "slug", "TEXT UNIQUE"),
            ("", "description", "TEXT"),
            ("", "level", "Beginner|Inter|Adv"),
            ("", "category", "TEXT"),
            ("", "price_cents", "INTEGER"),
            ("FK", "teacher_id", "→ users.id"),
            ("", "status", "draft|published|..."),
            ("", "access_type", "open|invite|mod"),
            ("", "rating", "NUMERIC(3,2)"),
            ("", "students_count", "INTEGER"),
        ]
    },
    "course_modules": {
        "color": "#b91c1c",
        "fields": [
            ("PK", "id", "SERIAL"),
            ("FK", "course_id", "→ courses.id"),
            ("", "title", "TEXT"),
            ("", "module_order", "INTEGER"),
            ("", "created_at", "TIMESTAMP"),
        ]
    },
    "lessons": {
        "color": "#b91c1c",
        "fields": [
            ("PK", "id", "SERIAL"),
            ("FK", "module_id", "→ course_modules.id"),
            ("", "title", "TEXT"),
            ("", "lesson_type", "video|text|inter"),
            ("", "content_text", "TEXT"),
            ("", "lesson_order", "INTEGER"),
        ]
    },
    "course_steps": {
        "color": "#b91c1c",
        "fields": [
            ("PK", "id", "SERIAL"),
            ("FK", "course_id", "→ courses.id"),
            ("FK", "lesson_id", "→ lessons.id"),
            ("", "title", "TEXT"),
            ("", "step_order", "INTEGER"),
            ("", "step_type", "theory|quiz|code|..."),
            ("", "content", "JSONB"),
            ("", "xp", "INTEGER"),
        ]
    },
    "assignments": {
        "color": "#b91c1c",
        "fields": [
            ("PK", "id", "SERIAL"),
            ("FK", "lesson_id", "→ lessons.id"),
            ("", "assignment_type", "code|essay|quiz"),
            ("", "title", "TEXT"),
            ("", "description", "TEXT"),
            ("", "tests", "JSONB"),
            ("", "rubric", "JSONB"),
            ("", "max_score", "INTEGER"),
        ]
    },
    "enrollments": {
        "color": "#15803d",
        "fields": [
            ("PK", "id", "SERIAL"),
            ("FK", "user_id", "→ users.id"),
            ("FK", "course_id", "→ courses.id"),
            ("", "status", "active|completed|cancelled"),
            ("", "progress_percent", "INTEGER"),
            ("", "created_at", "TIMESTAMP"),
        ]
    },
    "enrollment_requests": {
        "color": "#15803d",
        "fields": [
            ("PK", "id", "SERIAL"),
            ("FK", "user_id", "→ users.id"),
            ("FK", "course_id", "→ courses.id"),
            ("", "status", "pending|approved|rejected"),
            ("", "message", "TEXT"),
            ("", "teacher_comment", "TEXT"),
        ]
    },
    "submissions": {
        "color": "#7e22ce",
        "fields": [
            ("PK", "id", "SERIAL"),
            ("FK", "user_id", "→ users.id"),
            ("FK", "assignment_id", "→ assignments.id"),
            ("", "answer_text", "TEXT"),
            ("", "code_text", "TEXT"),
            ("", "score", "INTEGER"),
            ("", "status", "queued|passed|failed|..."),
            ("", "ai_feedback", "TEXT"),
            ("", "plagiarism_score", "INTEGER"),
        ]
    },
    "step_progress": {
        "color": "#7e22ce",
        "fields": [
            ("PK", "id", "SERIAL"),
            ("FK", "user_id", "→ users.id"),
            ("FK", "course_id", "→ courses.id"),
            ("FK", "lesson_id", "→ lessons.id"),
            ("FK", "assignment_id", "→ assignments.id"),
            ("", "step_id", "INTEGER"),
            ("", "status", "started|completed"),
            ("", "score", "INTEGER"),
            ("", "attempts", "INTEGER"),
        ]
    },
    "certificates": {
        "color": "#c2410c",
        "fields": [
            ("PK", "id", "SERIAL"),
            ("FK", "user_id", "→ users.id"),
            ("FK", "course_id", "→ courses.id"),
            ("", "cert_code", "TEXT UNIQUE"),
            ("", "issued_at", "TIMESTAMP"),
        ]
    },
    "payments": {
        "color": "#c2410c",
        "fields": [
            ("PK", "id", "SERIAL"),
            ("FK", "user_id", "→ users.id"),
            ("FK", "course_id", "→ courses.id"),
            ("", "amount_cents", "INTEGER"),
            ("", "currency", "TEXT"),
            ("", "status", "pending|paid|refunded|..."),
            ("", "provider", "TEXT"),
        ]
    },
    "notifications": {
        "color": "#0f766e",
        "fields": [
            ("PK", "id", "SERIAL"),
            ("FK", "user_id", "→ users.id"),
            ("", "title", "TEXT"),
            ("", "body", "TEXT"),
            ("", "is_read", "BOOLEAN"),
            ("", "created_at", "TIMESTAMP"),
        ]
    },
    "discussion_messages": {
        "color": "#0f766e",
        "fields": [
            ("PK", "id", "SERIAL"),
            ("FK", "course_id", "→ courses.id"),
            ("FK", "user_id", "→ users.id"),
            ("", "step_id", "INTEGER"),
            ("", "message", "TEXT"),
            ("", "created_at", "TIMESTAMP"),
        ]
    },
    "support_tickets": {
        "color": "#0f766e",
        "fields": [
            ("PK", "id", "SERIAL"),
            ("FK", "user_id", "→ users.id"),
            ("", "subject", "TEXT"),
            ("", "message", "TEXT"),
            ("", "status", "new|in_progress|closed"),
            ("FK", "replied_by", "→ users.id"),
        ]
    },
    "ai_reviews": {
        "color": "#0f766e",
        "fields": [
            ("PK", "id", "SERIAL"),
            ("FK", "user_id", "→ users.id"),
            ("", "quality", "INTEGER"),
            ("", "correctness", "INTEGER"),
            ("", "style", "INTEGER"),
            ("", "summary", "TEXT"),
            ("", "source_code", "TEXT"),
            ("", "language", "TEXT"),
        ]
    },
}

# Layout: (x, y) top-left of each table box
TABLE_W = 260
ROW_H = 22
HEADER_H = 32

positions = {
    # Auth cluster (left)
    "users":                   (40,   60),
    "account_profiles":        (40,  380),
    "refresh_tokens":          (40,  620),
    "password_reset_tokens":   (40,  820),

    # Course structure (center)
    "courses":                 (360,  60),
    "course_modules":          (360, 360),
    "lessons":                 (360, 540),
    "course_steps":            (360, 720),
    "assignments":             (360, 940),

    # Student activity (center-right)
    "enrollments":             (680,  60),
    "enrollment_requests":     (680, 280),
    "submissions":             (680, 460),
    "step_progress":           (680, 700),

    # Results / misc (right)
    "certificates":            (1000,  60),
    "payments":                (1000, 260),
    "notifications":           (1000, 450),
    "discussion_messages":     (1000, 640),
    "support_tickets":         (1000, 830),
    "ai_reviews":              (1000, 1040),
}

def table_height(name):
    return HEADER_H + len(tables[name]["fields"]) * ROW_H + 6

def build_svg():
    W, H = 1340, 1260
    lines = []
    lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
                 f'style="background:#f8fafc;font-family:\'Segoe UI\',Arial,sans-serif;">')

    # Gradient defs
    lines.append('<defs>')
    for name, tbl in tables.items():
        c = tbl["color"]
        lines.append(f'<linearGradient id="hdr_{name}" x1="0" y1="0" x2="0" y2="1">'
                     f'<stop offset="0%" stop-color="{c}"/>'
                     f'<stop offset="100%" stop-color="{c}cc"/></linearGradient>')
    lines.append('</defs>')

    # Section labels
    sections = [
        (40, 20, 280, "🔐 Аутентификация", "#1e40af"),
        (360, 20, 280, "📚 Структура курса", "#b91c1c"),
        (680, 20, 280, "🎓 Активность студентов", "#15803d"),
        (1000, 20, 280, "📊 Результаты / Прочее", "#0f766e"),
    ]
    for sx, sy, sw, label, color in sections:
        lines.append(f'<rect x="{sx}" y="{sy}" width="{sw}" height="24" rx="6" '
                     f'fill="{color}22" stroke="{color}44" stroke-width="1"/>')
        lines.append(f'<text x="{sx+sw//2}" y="{sy+16}" text-anchor="middle" '
                     f'font-size="12" font-weight="600" fill="{color}">{label}</text>')

    # Draw relationships (arrows/lines) BEHIND tables
    def mid_right(name):
        x, y = positions[name]
        return x + TABLE_W, y + HEADER_H // 2

    def mid_left(name):
        x, y = positions[name]
        return x, y + HEADER_H // 2

    def mid_bottom(name):
        x, y = positions[name]
        return x + TABLE_W // 2, y + table_height(name)

    def mid_top(name):
        x, y = positions[name]
        return x + TABLE_W // 2, y

    rels = [
        # Auth
        ("users", "account_profiles", "1:1"),
        ("users", "refresh_tokens", "1:N"),
        ("users", "password_reset_tokens", "1:N"),
        # Course hierarchy
        ("courses", "course_modules", "1:N"),
        ("course_modules", "lessons", "1:N"),
        ("lessons", "course_steps", "1:N"),
        ("lessons", "assignments", "1:N"),
        # Student ↔ course
        ("users", "enrollments", "1:N"),
        ("courses", "enrollments", "1:N"),
        ("users", "enrollment_requests", "1:N"),
        ("courses", "enrollment_requests", "1:N"),
        # Submissions
        ("users", "submissions", "1:N"),
        ("assignments", "submissions", "1:N"),
        # Step progress
        ("users", "step_progress", "1:N"),
        ("courses", "step_progress", "1:N"),
        ("lessons", "step_progress", "1:N"),
        # Results
        ("users", "certificates", "1:N"),
        ("courses", "certificates", "1:N"),
        ("users", "payments", "1:N"),
        ("courses", "payments", "1:N"),
        # Misc
        ("users", "notifications", "1:N"),
        ("courses", "discussion_messages", "1:N"),
        ("users", "discussion_messages", "1:N"),
        ("users", "support_tickets", "1:N"),
        ("users", "ai_reviews", "1:N"),
        # teacher
        ("users", "courses", "1:N"),
    ]

    def draw_line(x1, y1, x2, y2, color="#94a3b8"):
        # simple orthogonal line
        mx = (x1 + x2) // 2
        lines.append(
            f'<polyline points="{x1},{y1} {mx},{y1} {mx},{y2} {x2},{y2}" '
            f'fill="none" stroke="{color}" stroke-width="1.2" stroke-dasharray="4,3" opacity="0.6"/>'
        )

    for src, dst, card in rels:
        if src not in positions or dst not in positions:
            continue
        sx, sy = positions[src]
        dx, dy = positions[dst]
        # pick exit/entry sides based on relative position
        if abs(sx - dx) >= abs(sy - dy):
            # horizontal
            if sx < dx:
                x1, y1 = mid_right(src)
                x2, y2 = mid_left(dst)
            else:
                x1, y1 = mid_left(src)
                x2, y2 = mid_right(dst)
        else:
            # vertical
            if sy < dy:
                x1, y1 = mid_bottom(src)
                x2, y2 = mid_top(dst)
            else:
                x1, y1 = mid_top(src)
                x2, y2 = mid_bottom(dst)
        draw_line(x1, y1, x2, y2)

    # Draw tables
    for name, tbl in tables.items():
        if name not in positions:
            continue
        x, y = positions[name]
        h = table_height(name)
        color = tbl["color"]

        # Shadow
        lines.append(f'<rect x="{x+3}" y="{y+3}" width="{TABLE_W}" height="{h}" '
                     f'rx="8" fill="#00000018"/>')
        # Body
        lines.append(f'<rect x="{x}" y="{y}" width="{TABLE_W}" height="{h}" '
                     f'rx="8" fill="white" stroke="{color}55" stroke-width="1.5"/>')
        # Header
        lines.append(f'<rect x="{x}" y="{y}" width="{TABLE_W}" height="{HEADER_H}" '
                     f'rx="8" fill="url(#hdr_{name})"/>')
        lines.append(f'<rect x="{x}" y="{y+16}" width="{TABLE_W}" height="{HEADER_H-16}" '
                     f'fill="{color}cc"/>')
        lines.append(f'<text x="{x+TABLE_W//2}" y="{y+21}" text-anchor="middle" '
                     f'font-size="13" font-weight="700" fill="white">{name}</text>')

        # Fields
        for i, (key, fname, ftype) in enumerate(tbl["fields"]):
            fy = y + HEADER_H + i * ROW_H + ROW_H // 2 + 7
            # Alternate row
            if i % 2 == 0:
                lines.append(f'<rect x="{x+1}" y="{y+HEADER_H+i*ROW_H+1}" '
                              f'width="{TABLE_W-2}" height="{ROW_H}" fill="{color}08"/>')

            # Key badge
            if key:
                badge_color = "#f59e0b" if "PK" in key else "#6366f1" if "FK" in key else "#94a3b8"
                lines.append(f'<rect x="{x+6}" y="{fy-11}" width="28" height="14" '
                              f'rx="3" fill="{badge_color}22" stroke="{badge_color}88" stroke-width="1"/>')
                lines.append(f'<text x="{x+20}" y="{fy}" text-anchor="middle" '
                              f'font-size="8" font-weight="700" fill="{badge_color}">{key}</text>')
                field_x = x + 38
            else:
                field_x = x + 10

            lines.append(f'<text x="{field_x}" y="{fy}" font-size="11" fill="#1e293b" '
                         f'font-weight="{"600" if key else "400"}">{fname}</text>')
            lines.append(f'<text x="{x+TABLE_W-8}" y="{fy}" text-anchor="end" '
                         f'font-size="10" fill="#94a3b8">{ftype}</text>')

        # Bottom border decoration
        lines.append(f'<rect x="{x}" y="{y+h-3}" width="{TABLE_W}" height="3" '
                     f'rx="0" fill="{color}66" '
                     f'style="border-radius:0 0 8px 8px"/>')

    # Legend
    lx, ly = 40, H - 80
    lines.append(f'<rect x="{lx}" y="{ly}" width="520" height="55" rx="8" '
                 f'fill="white" stroke="#e2e8f0" stroke-width="1"/>')
    lines.append(f'<text x="{lx+10}" y="{ly+18}" font-size="11" font-weight="700" fill="#475569">Легенда:</text>')

    legend_items = [
        ("#f59e0b", "PK — Primary Key"),
        ("#6366f1", "FK — Foreign Key"),
        ("#94a3b8", "─ ─ ─  связь таблиц"),
    ]
    for i, (c, label) in enumerate(legend_items):
        lxi = lx + 10 + i * 170
        lines.append(f'<rect x="{lxi}" y="{ly+26}" width="12" height="12" rx="2" fill="{c}33" stroke="{c}" stroke-width="1.5"/>')
        lines.append(f'<text x="{lxi+16}" y="{ly+37}" font-size="11" fill="#475569">{label}</text>')

    # Title
    lines.append(f'<text x="{W//2}" y="{H-15}" text-anchor="middle" font-size="12" '
                 f'fill="#94a3b8">Gradus EdTech Platform — ER-диаграмма базы данных</text>')

    lines.append('</svg>')
    return '\n'.join(lines)


svg = build_svg()
out = r"C:\Users\yaros\Desktop\stepashka\er_diagram.svg"
with open(out, "w", encoding="utf-8") as f:
    f.write(svg)
print(f"Saved: {out}  ({len(svg)//1024} KB)")
