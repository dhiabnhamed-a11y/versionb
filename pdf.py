from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, PageBreak
)
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus.flowables import Flowable
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

W, H = A4

# ── PALETTE ──────────────────────────────────────────────────────────────────
BG       = colors.HexColor("#0B0B1F")
SURFACE  = colors.HexColor("#12122A")
SURFACE2 = colors.HexColor("#1A1A35")
CYAN     = colors.HexColor("#00C8F0")
VIOLET   = colors.HexColor("#7C5CFF")
GREEN    = colors.HexColor("#00E89A")
AMBER    = colors.HexColor("#FFB300")
RED      = colors.HexColor("#FF4466")
WHITE    = colors.HexColor("#FFFFFF")
TEXT     = colors.HexColor("#E8E8F4")
MUTED    = colors.HexColor("#8888AA")
DIM      = colors.HexColor("#44445A")
BORDER   = colors.HexColor("#1E1E40")


# ── BACKGROUND CANVAS ────────────────────────────────────────────────────────
def dark_bg(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFillColor(BG)
    canvas_obj.rect(0, 0, W, H, fill=1, stroke=0)
    # subtle grid lines
    canvas_obj.setStrokeColor(colors.HexColor("#0F0F2A"))
    canvas_obj.setLineWidth(0.3)
    step = 20 * mm
    for x in range(0, int(W) + int(step), int(step)):
        canvas_obj.line(x, 0, x, H)
    for y in range(0, int(H) + int(step), int(step)):
        canvas_obj.line(0, y, W, y)
    # subtle top gradient line
    canvas_obj.setStrokeColor(CYAN)
    canvas_obj.setLineWidth(1.5)
    canvas_obj.line(0, H - 1, W, H - 1)
    canvas_obj.restoreState()


# ── STYLES ───────────────────────────────────────────────────────────────────
def make_styles():
    s = {}

    def ps(name, **kw):
        base = kw.pop("parent", None)
        if base:
            from copy import deepcopy
            p = deepcopy(s[base])
            p.name = name
            for k, v in kw.items():
                setattr(p, k, v)
            s[name] = p
        else:
            s[name] = ParagraphStyle(name, **kw)

    # base
    ps("body",    fontName="Helvetica",       fontSize=10, leading=15,
                  textColor=TEXT,             backColor=None,
                  spaceAfter=6,               alignment=TA_LEFT)

    ps("body_center", parent="body", alignment=TA_CENTER)

    ps("muted",   parent="body",   textColor=MUTED, fontSize=9.5)
    ps("muted_c", parent="muted",  alignment=TA_CENTER)

    # section labels
    ps("eyebrow", fontName="Helvetica-Bold", fontSize=8, leading=12,
                  textColor=CYAN,            letterSpacing=2,
                  spaceAfter=4,              alignment=TA_LEFT)

    ps("eyebrow_c", parent="eyebrow", alignment=TA_CENTER)

    # headings
    ps("h1",      fontName="Helvetica-Bold", fontSize=34, leading=38,
                  textColor=WHITE,           spaceAfter=8, alignment=TA_CENTER)

    ps("h2",      fontName="Helvetica-Bold", fontSize=24, leading=28,
                  textColor=WHITE,           spaceAfter=6)

    ps("h2_c",    parent="h2",  alignment=TA_CENTER)

    ps("h3",      fontName="Helvetica-Bold", fontSize=16, leading=20,
                  textColor=WHITE,           spaceAfter=4)

    ps("h3_c",    parent="h3",  alignment=TA_CENTER)

    # big numbers
    ps("stat",    fontName="Helvetica-Bold", fontSize=28, leading=32,
                  textColor=WHITE,           alignment=TA_CENTER)

    ps("stat_cyan",   parent="stat", textColor=CYAN)
    ps("stat_violet", parent="stat", textColor=VIOLET)
    ps("stat_green",  parent="stat", textColor=GREEN)
    ps("stat_amber",  parent="stat", textColor=AMBER)
    ps("stat_red",    parent="stat", textColor=RED)

    ps("stat_label",  fontName="Helvetica", fontSize=8, leading=11,
                      textColor=MUTED,      alignment=TA_CENTER, spaceAfter=4)

    # code / mono
    ps("mono",    fontName="Courier",  fontSize=8.5, leading=13,
                  textColor=MUTED)
    ps("mono_c",  parent="mono",       alignment=TA_CENTER)
    ps("mono_cyan", parent="mono",     textColor=CYAN)

    # tag
    ps("tag",     fontName="Helvetica-Bold", fontSize=8, leading=12,
                  textColor=CYAN,            alignment=TA_CENTER)

    # price
    ps("price",   fontName="Helvetica-Bold", fontSize=30, leading=34,
                  textColor=WHITE,           alignment=TA_LEFT)

    ps("price_sub", fontName="Helvetica", fontSize=11, leading=14,
                    textColor=MUTED,       alignment=TA_LEFT)

    # bullet
    ps("bullet",  fontName="Helvetica", fontSize=10, leading=15,
                  textColor=TEXT,        leftIndent=14, spaceAfter=3,
                  bulletText="›",        bulletColor=VIOLET, bulletFontName="Helvetica",
                  bulletFontSize=12, bulletIndent=0)

    ps("check",   parent="bullet", bulletText="✓", bulletColor=GREEN)

    # slide number
    ps("slide_num", fontName="Helvetica", fontSize=8, leading=11,
                    textColor=DIM,        alignment=TA_RIGHT)

    return s


S = make_styles()


# ── CUSTOM FLOWABLES ─────────────────────────────────────────────────────────
class ColorBar(Flowable):
    def __init__(self, color, width=None, height=2):
        super().__init__()
        self._color = color
        self._w = width
        self._h = height

    def wrap(self, available_width, available_height):
        self._w = self._w or available_width
        return (self._w, self._h + 4)

    def draw(self):
        self.canv.setFillColor(self._color)
        self.canv.rect(0, 2, self._w, self._h, fill=1, stroke=0)


class GlowLine(Flowable):
    def wrap(self, aw, ah):
        return (aw, 8)
    def draw(self):
        w = self._width if hasattr(self, "_width") else 500
        # draw a simple line, gradient-ish via opacity
        self.canv.setStrokeColor(CYAN)
        self.canv.setLineWidth(0.5)
        self.canv.line(0, 4, w, 4)


class RoundedBox(Flowable):
    """A colored rounded box with label + value text."""
    def __init__(self, label, value, value_color=WHITE, width=120, height=70, border_color=None):
        super().__init__()
        self.label = label
        self.value = value
        self.value_color = value_color
        self.width = width
        self.height = height
        self.border_color = border_color or BORDER

    def wrap(self, aw, ah):
        return (self.width, self.height)

    def draw(self):
        c = self.canv
        w, h = self.width, self.height
        # background
        c.setFillColor(SURFACE)
        c.setStrokeColor(self.border_color)
        c.setLineWidth(0.8)
        c.roundRect(0, 0, w, h, 6, fill=1, stroke=1)
        # value
        c.setFillColor(self.value_color)
        c.setFont("Helvetica-Bold", 20)
        c.drawCentredString(w / 2, h - 30, self.value)
        # label
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 7.5)
        # wrap label
        label = self.label
        c.drawCentredString(w / 2, 10, label)


class LayerRow(Flowable):
    def __init__(self, layer_label, chips, color, width=480):
        super().__init__()
        self.layer_label = layer_label
        self.chips = chips
        self.color = color
        self.width = width

    def wrap(self, aw, ah):
        return (self.width, 30)

    def draw(self):
        c = self.canv
        w = self.width
        # background
        from reportlab.lib.colors import Color
        r, g, b, _ = self.color.red, self.color.green, self.color.blue, 1
        bg = colors.Color(r, g, b, alpha=0.06)
        c.setFillColor(SURFACE)
        c.setStrokeColor(self.color)
        c.setLineWidth(0.8)
        c.roundRect(0, 0, w, 28, 4, fill=1, stroke=0)
        # left accent bar
        c.setFillColor(self.color)
        c.rect(0, 0, 3, 28, fill=1, stroke=0)
        # label
        c.setFillColor(self.color)
        c.setFont("Courier-Bold", 8)
        c.drawString(10, 10, self.layer_label)
        # chips
        x = 120
        c.setFont("Helvetica", 8)
        for chip in self.chips:
            tw = c.stringWidth(chip, "Helvetica", 8)
            c.setFillColor(SURFACE2)
            c.setStrokeColor(BORDER)
            c.setLineWidth(0.5)
            c.roundRect(x, 5, tw + 12, 18, 3, fill=1, stroke=1)
            c.setFillColor(MUTED)
            c.drawString(x + 6, 9, chip)
            x += tw + 20
            if x > w - 60:
                break


class CompareTable(Flowable):
    def __init__(self, rows, width=480):
        super().__init__()
        self.rows = rows
        self.width = width

    def wrap(self, aw, ah):
        return (self.width, len(self.rows) * 24 + 28)

    def draw(self):
        c = self.canv
        w = self.width
        headers = ["Capability", "TASKIT OS", "Monday.com", "ServiceNow", "Asana"]
        col_ws = [0.30, 0.25, 0.15, 0.15, 0.15]
        col_ws = [int(x * w) for x in col_ws]
        total_h = len(self.rows) * 24 + 28
        y = total_h - 28

        # header
        c.setFillColor(SURFACE2)
        c.rect(0, y, w, 26, fill=1, stroke=0)
        x = 0
        for i, (h, cw) in enumerate(zip(headers, col_ws)):
            fc = CYAN if i == 1 else MUTED
            c.setFillColor(fc)
            c.setFont("Helvetica-Bold", 8)
            c.drawString(x + 6, y + 9, h)
            x += cw

        # rows
        for ri, row in enumerate(self.rows):
            ry = y - (ri + 1) * 24
            if ri % 2 == 0:
                c.setFillColor(colors.HexColor("#0E0E25"))
                c.rect(0, ry, w, 22, fill=1, stroke=0)
            x = 0
            for ci, (cell, cw) in enumerate(zip(row, col_ws)):
                if ci == 0:
                    c.setFillColor(TEXT)
                    c.setFont("Helvetica", 8.5)
                elif ci == 1:
                    c.setFillColor(CYAN)
                    c.setFont("Helvetica-Bold", 8)
                else:
                    c.setFillColor(MUTED)
                    c.setFont("Helvetica", 8)
                # truncate
                max_w = cw - 8
                while c.stringWidth(cell, c._fontname, c._fontsize) > max_w and len(cell) > 3:
                    cell = cell[:-2]
                c.drawString(x + 6, ry + 7, cell)
                x += cw
            # divider
            c.setStrokeColor(BORDER)
            c.setLineWidth(0.3)
            c.line(0, ry, w, ry)


# ── HELPER BUILDERS ──────────────────────────────────────────────────────────
def slide_header(eyebrow, title, subtitle=None, center=False, title_color=WHITE):
    e_style = S["eyebrow_c"] if center else S["eyebrow"]
    t_style = S["h2_c"] if center else S["h2"]
    s_style = S["muted_c"] if center else S["muted"]
    items = [
        Paragraph(eyebrow.upper(), e_style),
        Paragraph(title, t_style),
    ]
    if subtitle:
        items.append(Spacer(1, 2))
        items.append(Paragraph(subtitle, s_style))
    items.append(Spacer(1, 8))
    return items


def stat_table(cells):
    """cells = [(value, label, color), ...]"""
    n = len(cells)
    col_w = 480 / n
    data = [[
        Paragraph(v, ParagraphStyle("sv", fontName="Helvetica-Bold", fontSize=22,
                                    leading=26, textColor=c, alignment=TA_CENTER))
        for v, _, c in cells
    ], [
        Paragraph(l, S["stat_label"])
        for _, l, _ in cells
    ]]
    t = Table(data, colWidths=[col_w] * n, rowHeights=[34, 20])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("LINEAFTER", (0, 0), (-2, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 6),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    return t


def card_table(rows_of_cards, col_widths=None):
    """Each card is (title, text, color)."""
    col_widths = col_widths or [240, 240]
    n_cols = len(col_widths)

    def make_cell(title, text, accent):
        inner = [
            Paragraph(f'<font color="#{accent[1:]}">{title}</font>',
                      ParagraphStyle("ct", fontName="Helvetica-Bold", fontSize=11,
                                     leading=14, textColor=WHITE, spaceAfter=3)),
            Paragraph(text, ParagraphStyle("cd", fontName="Helvetica", fontSize=9,
                                           leading=13, textColor=MUTED)),
        ]
        return inner

    data = []
    for row in rows_of_cards:
        row_data = [make_cell(*cell) for cell in row]
        # pad if needed
        while len(row_data) < n_cols:
            row_data.append("")
        data.append(row_data)

    t = Table(data, colWidths=col_widths, spaceBefore=0, spaceAfter=4)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("LINEBEFORE", (1, 0), (-1, -1), 0.5, BORDER),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


def section_divider(color=CYAN):
    return ColorBar(color, height=1)


def kv_row(label, value, value_color=CYAN):
    data = [[
        Paragraph(label, S["muted"]),
        Paragraph(f'<font color="#{value_color.hexval()[1:]}">{value}</font>',
                  ParagraphStyle("kv", fontName="Helvetica-Bold", fontSize=12,
                                 leading=15, textColor=value_color, alignment=TA_RIGHT)),
    ]]
    t = Table(data, colWidths=[300, 180])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
    ]))
    return t


# ── PAGE CONTENT ─────────────────────────────────────────────────────────────
def build_story():
    story = []
    PB = PageBreak

    # ── SLIDE 1: COVER ───────────────────────────────────────────────────────
    story += [
        Spacer(1, 30),
        Paragraph("STRATEGIC ACQUISITION OPPORTUNITY · 2025", S["eyebrow_c"]),
        Spacer(1, 10),
        Paragraph("TASKIT OS", ParagraphStyle(
            "cover_main", fontName="Helvetica-Bold", fontSize=56, leading=58,
            textColor=WHITE, alignment=TA_CENTER, spaceAfter=4)),
        Paragraph("THE UNIFIED ENTERPRISE OPERATING SYSTEM",
                  ParagraphStyle("cover_tagline", fontName="Helvetica-Bold", fontSize=14,
                                 leading=18, textColor=CYAN, alignment=TA_CENTER, spaceAfter=12)),
        Paragraph("10 Workspaces · 32 Modules · One Platform · Built to replace 15 tools with a single command center.",
                  ParagraphStyle("cover_sub", fontName="Helvetica", fontSize=11, leading=17,
                                 textColor=MUTED, alignment=TA_CENTER, spaceAfter=20)),
        Spacer(1, 6),
    ]

    # tag chips row
    tag_data = [[
        Paragraph("Centralized Operations", S["tag"]),
        Paragraph("AI Orchestration", S["tag"]),
        Paragraph("Real-Time Intelligence", S["tag"]),
        Paragraph("Enterprise Scale", S["tag"]),
    ]]
    tt = Table(tag_data, colWidths=[120, 110, 130, 120])
    tt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#001E2E")),
        ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#160B30")),
        ("BACKGROUND", (2, 0), (2, 0), colors.HexColor("#001E14")),
        ("BACKGROUND", (3, 0), (3, 0), colors.HexColor("#221800")),
        ("BOX", (0, 0), (0, 0), 0.5, CYAN),
        ("BOX", (1, 0), (1, 0), 0.5, VIOLET),
        ("BOX", (2, 0), (2, 0), 0.5, GREEN),
        ("BOX", (3, 0), (3, 0), 0.5, AMBER),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [tt, Spacer(1, 20)]

    story.append(stat_table([
        ("10×", "Workspace Types", CYAN),
        ("32", "Integrated Modules", WHITE),
        ("$340B", "Addressable Market", CYAN),
        ("24mo", "Development Time", WHITE),
    ]))
    story.append(PB())

    # ── SLIDE 2: PROBLEM ─────────────────────────────────────────────────────
    story += slide_header("The Crisis", "The Fragmented Enterprise",
                          "Organizations are drowning in tool sprawl — costing millions in waste, inefficiency, and invisible friction.")

    # big stats
    story.append(stat_table([
        ("15–25", "SaaS tools per enterprise", RED),
        ("30%", "Time lost to context-switching", AMBER),
        ("$2M+", "Annual integration cost", VIOLET),
        ("0", "Single source of truth", CYAN),
    ]))
    story.append(Spacer(1, 14))

    problems = [
        ("Data fragmentation creates blind spots", "No single source of truth across departments."),
        ("Integration complexity costs $500K–$2M+", "Annually in middleware, custom builds, and IT overhead."),
        ("Security risks multiply", "With every additional vendor and API surface area."),
        ("Employee onboarding takes weeks", "Instead of hours, due to tool complexity across systems."),
        ("Client experience suffers", "When systems don't communicate with each other."),
        ("Licensing waste compounds", "Enterprises pay for 15 tools but only need one."),
    ]
    for bold, rest in problems:
        story.append(Paragraph(
            f'<font color="#FF4466">●</font>  <b><font color="#E8E8F4">{bold}</font></b> — {rest}',
            ParagraphStyle("prob", fontName="Helvetica", fontSize=10, leading=15,
                           textColor=MUTED, spaceAfter=5, leftIndent=4)
        ))
    story.append(PB())

    # ── SLIDE 3: MARKET ──────────────────────────────────────────────────────
    story += slide_header("Opportunity", "One Acquisition. Six Markets.",
                          "Every customer replaces $15K–$200K+ in annual tool spend. Taskit OS captures budget from multiple verticals simultaneously.")

    story.append(Paragraph(
        '<font color="#00C8F0" size="48"><b>$340B</b></font>',
        ParagraphStyle("mhero", fontName="Helvetica-Bold", fontSize=40, leading=44,
                       textColor=CYAN, alignment=TA_CENTER, spaceAfter=2)))
    story.append(Paragraph("ADDRESSABLE MARKET", S["eyebrow_c"]))
    story.append(Spacer(1, 14))

    market_data = [
        [Paragraph("$80B+", ParagraphStyle("mv", fontName="Helvetica-Bold", fontSize=18, textColor=CYAN, alignment=TA_CENTER)),
         Paragraph("$78B", ParagraphStyle("mv", fontName="Helvetica-Bold", fontSize=18, textColor=VIOLET, alignment=TA_CENTER)),
         Paragraph("$45B", ParagraphStyle("mv", fontName="Helvetica-Bold", fontSize=18, textColor=GREEN, alignment=TA_CENTER)),
         Paragraph("$35B", ParagraphStyle("mv", fontName="Helvetica-Bold", fontSize=18, textColor=AMBER, alignment=TA_CENTER)),
         Paragraph("$22B", ParagraphStyle("mv", fontName="Helvetica-Bold", fontSize=18, textColor=RED, alignment=TA_CENTER)),
         Paragraph("$8.2B", ParagraphStyle("mv", fontName="Helvetica-Bold", fontSize=18, textColor=WHITE, alignment=TA_CENTER)),
         ],
        [Paragraph("CRM Software", S["stat_label"]),
         Paragraph("ERP Software", S["stat_label"]),
         Paragraph("Service Ops", S["stat_label"]),
         Paragraph("HR Workforce", S["stat_label"]),
         Paragraph("AI Operations", S["stat_label"]),
         Paragraph("Project Mgmt", S["stat_label"]),
         ],
    ]
    mt = Table(market_data, colWidths=[80] * 6, rowHeights=[30, 20])
    mt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("LINEAFTER", (0, 0), (-2, -1), 0.5, BORDER),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(mt)
    story.append(Spacer(1, 14))
    story.append(kv_row("Budget replaced per customer", "$15K – $200K / yr", CYAN))
    story.append(Spacer(1, 4))
    story.append(kv_row("AI ops market CAGR", "28% CAGR", GREEN))
    story.append(Spacer(1, 4))
    story.append(kv_row("Projected market by 2030", "$580B", VIOLET))
    story.append(PB())

    # ── SLIDE 4: PLATFORM ARCHITECTURE ──────────────────────────────────────
    story += slide_header("Architecture", "Enterprise-Grade Architecture",
                          "Six integrated layers, 32 modules, 10 workspace types — unified multi-tenant infrastructure designed for global scale.")

    layers = [
        ("Layer 6 · UI",          ["Admin Portal", "Employee App", "Client Portal", "Mobile PWA"],        WHITE),
        ("Layer 5 · AI",          ["Agents", "Automation", "RAG", "Governance"],                          CYAN),
        ("Layer 4 · Workspaces",  ["10 Industry Types", "Dynamic Routing", "Theme Engine"],               VIOLET),
        ("Layer 3 · Modules",     ["Projects", "Finance", "HR", "EMS", "+28 more"],                      GREEN),
        ("Layer 2 · Security",    ["Multi-Tenancy", "RBAC", "RLS", "MFA"],                               AMBER),
        ("Layer 1 · Infra",       ["PostgreSQL", "Redis", "Cloudflare", "BullMQ"],                        RED),
    ]
    for label, chips, color in layers:
        story.append(LayerRow(label, chips, color))
        story.append(Spacer(1, 5))

    story.append(Spacer(1, 12))
    story.append(Paragraph("TECH STACK", S["eyebrow"]))

    def tech_row(category, items, color):
        items_str = "  ·  ".join(items)
        return Paragraph(
            f'<font color="#{color.hexval()[1:]}">{category}</font>   '
            f'<font color="#8888AA">{items_str}</font>',
            ParagraphStyle("tr", fontName="Helvetica", fontSize=9.5, leading=14,
                           textColor=MUTED, spaceAfter=4))

    story.append(tech_row("Frontend    ", ["Next.js 16.2", "React 19.2", "TypeScript 5.x", "Tailwind v4", "Framer Motion", "Recharts"], CYAN))
    story.append(tech_row("Backend     ", ["Prisma 5.22", "PostgreSQL", "Redis", "Socket.IO 4.8", "BullMQ", "Zod"], VIOLET))
    story.append(tech_row("Infrastructure", ["Cloudflare", "Supabase", "Cloudinary", "Firebase FCM", "Stripe + Dodo"], GREEN))

    story.append(Spacer(1, 10))
    story.append(stat_table([
        ("43", "API Integration Groups", CYAN),
        ("<15ms", "Event Delivery Latency", GREEN),
        ("713+", "Source Files (Typed)", WHITE),
    ]))
    story.append(PB())

    # ── SLIDE 5: WORKSPACES ──────────────────────────────────────────────────
    story += slide_header("10 Industry Workspaces", "One Platform, Infinite Configurations",
                          "Each workspace dynamically reconfigures terminology, dashboards, modules, and UI — same engine, different cockpit.")

    ws_data = [
        ["🏭 Industry", "🎨 Digital Agency", "🎬 Content Studio", "🏥 Healthcare", "🏢 Enterprise Ops"],
        ["General Operations", "Creative Studios", "YouTube · Spotify · Social", "Hospital Networks", "Large Organizations"],
        ["🩺 Clinic", "💻 Corporate IT", "📊 ERP Workspace", "🚑 EMS Agency", "⚙️ Custom"],
        ["Medical Practices", "ITIL Service Mgmt", "Full Business Suite", "Emergency Services", "Configurable"],
    ]
    col_w = [96] * 5
    wt = Table(ws_data, colWidths=col_w, rowHeights=[28, 18, 28, 18])
    wt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("BACKGROUND", (0, 1), (-1, 1), SURFACE2),
        ("BACKGROUND", (0, 3), (-1, 3), SURFACE2),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 2), (-1, 2), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica"),
        ("FONTNAME", (0, 3), (-1, 3), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, 0), 11),
        ("FONTSIZE", (0, 2), (-1, 2), 11),
        ("FONTSIZE", (0, 1), (-1, 1), 8),
        ("FONTSIZE", (0, 3), (-1, 3), 8),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("TEXTCOLOR", (0, 2), (-1, 2), WHITE),
        ("TEXTCOLOR", (0, 1), (-1, 1), MUTED),
        ("TEXTCOLOR", (0, 3), (-1, 3), MUTED),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(wt)
    story.append(Spacer(1, 16))

    highlight = Table([[
        Paragraph("One codebase · One database · One deployment — but <b>10 completely different user experiences</b>",
                  ParagraphStyle("wh", fontName="Helvetica", fontSize=10.5, leading=16, textColor=TEXT)),
        Paragraph('<b><font color="#00C8F0">10 Markets</font></b>\n<font color="#8888AA" size="10">in one acquisition</font>',
                  ParagraphStyle("wh2", fontName="Helvetica-Bold", fontSize=18, leading=24, textColor=WHITE, alignment=TA_RIGHT)),
    ]], colWidths=[340, 140])
    highlight.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#001525")),
        ("BOX", (0, 0), (-1, -1), 0.8, CYAN),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("LEFTPADDING", (0, 0), (0, 0), 16),
        ("RIGHTPADDING", (-1, 0), (-1, 0), 16),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(highlight)
    story.append(PB())

    # ── SLIDE 6: MODULES ─────────────────────────────────────────────────────
    story += slide_header("Complete Ecosystem", "32 Integrated Modules",
                          "Every function your organization needs, pre-integrated and unified in a single shared data layer.")

    module_groups = [
        ("⚡ Core Operations", ["Projects & Campaigns", "Tasks & Briefs", "Clients & Accounts",
                                "Calendar & Events", "Real-Time Command Center", "Alerts & Notifications", "Search (cross-entity)"]),
        ("💰 Financial Suite",  ["Double-Entry Accounting", "Invoices & Billing", "Accounts Payable/Receivable",
                                  "Budgeting & Forecasting", "Payroll", "Treasury Management", "Expenses & Tax"]),
        ("👥 People Operations", ["HR Management", "Shift & Scheduling", "Access Control & RBAC",
                                   "Onboarding Workflows", "Time & Attendance", "Performance Tracking", "Document Management"]),
        ("🚨 Industry-Specific", ["EMS Computer-Aided Dispatch", "Fleet GPS Tracking", "Incident Management",
                                   "Healthcare Operations", "Enterprise Service Mgmt", "Full ERP Suite", "Social Integrations (9)"]),
    ]

    def module_col(title, items):
        paras = [Paragraph(f'<font color="#00C8F0">{title}</font>',
                           ParagraphStyle("mgt", fontName="Helvetica-Bold", fontSize=10,
                                          leading=14, textColor=CYAN, spaceAfter=6))]
        for item in items:
            paras.append(Paragraph(
                f'<font color="#7C5CFF">›</font>  {item}',
                ParagraphStyle("mi", fontName="Helvetica", fontSize=9.5, leading=14,
                               textColor=MUTED, spaceAfter=2)))
        return paras

    cols = [module_col(t, i) for t, i in module_groups]
    mt2 = Table([cols], colWidths=[120] * 4)
    mt2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("LINEAFTER", (0, 0), (-2, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(mt2)
    story.append(PB())

    # ── SLIDE 7: AI ENGINE ───────────────────────────────────────────────────
    story += slide_header("Native AI", "Not a Chatbot. An Orchestration System.",
                          "A deeply integrated AI subsystem with multiple specialized agents, tool execution, memory, governance, and full observability.")

    ai_features = [
        (CYAN,   "Multi-Agent Architecture",  "Specialized agents for every function"),
        (VIOLET, "Tool Registry",             "Agents execute controlled platform operations"),
        (GREEN,  "RAG System",                "Workspace-aware grounded context retrieval"),
        (AMBER,  "Governance Layer",          "Permission boundaries, audit trails, injection protection"),
        (RED,    "Memory System",             "Persistent conversation context and awareness"),
    ]
    for color, title, desc in ai_features:
        story.append(Paragraph(
            f'<font color="#{color.hexval()[1:]}">●</font>  <b><font color="#E8E8F4">{title}</font></b> — {desc}',
            ParagraphStyle("ai", fontName="Helvetica", fontSize=10, leading=15,
                           textColor=MUTED, spaceAfter=5)))

    story.append(Spacer(1, 10))
    story.append(Paragraph("SPECIALIZED AGENTS", S["eyebrow"]))

    agents = [
        ("🧠", "Executive",      "Strategic decisions and cross-module orchestration"),
        ("⚙️", "Operations",     "Workflow automation and resource coordination"),
        ("✅", "Approval",       "Human-in-the-loop approval workflows"),
        ("💰", "Finance",        "Invoicing, billing, and financial analysis"),
        ("👥", "Resource",       "Team allocation and capacity planning"),
        ("🎯", "Client Success", "Relationship health and churn detection"),
        ("🎨", "Creative Dir",   "Agency-specific creative project guidance"),
        ("🤖", "Automation",     "Build and optimize workflow automations"),
    ]

    agent_cells = []
    row = []
    for i, (icon, name, desc) in enumerate(agents):
        cell = [
            Paragraph(f"{icon}  {name}",
                      ParagraphStyle("an", fontName="Helvetica-Bold", fontSize=10,
                                     leading=13, textColor=WHITE, spaceAfter=2)),
            Paragraph(desc, ParagraphStyle("ad", fontName="Helvetica", fontSize=8.5,
                                           leading=12, textColor=MUTED)),
        ]
        row.append(cell)
        if len(row) == 4:
            agent_cells.append(row)
            row = []
    if row:
        while len(row) < 4:
            row.append("")
        agent_cells.append(row)

    at = Table(agent_cells, colWidths=[120] * 4)
    at.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(at)
    story.append(PB())

    # ── SLIDE 8: SECURITY ────────────────────────────────────────────────────
    story += slide_header("Defense in Depth", "Enterprise Security Architecture",
                          "Multi-layered security controls across every surface. Built to pass SOC 2, HIPAA, and FedRAMP audits.")

    sec_highlights = [
        (GREEN,  "🔐", "MFA + JWT",         "TOTP with recovery codes"),
        (CYAN,   "🛡️", "Row-Level Security", "PostgreSQL RLS policies"),
        (VIOLET, "👁️", "Full Audit Trail",   "Every sensitive action logged"),
        (AMBER,  "⚡", "Rate Limiting",      "Redis-backed brute force protection"),
    ]
    sh_data = [[
        [Paragraph(f"{icon}  {title}",
                   ParagraphStyle("sh_t", fontName="Helvetica-Bold", fontSize=10, leading=14,
                                  textColor=color, spaceAfter=2)),
         Paragraph(desc, S["muted_c"])]
        for color, icon, title, desc in sec_highlights
    ]]
    sht = Table(sh_data, colWidths=[120] * 4)
    sht.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(sht)
    story.append(Spacer(1, 14))
    story.append(Paragraph("SECURITY LAYERS", S["eyebrow"]))

    security_rings = [
        ("Authentication",   ["NextAuth v5", "TOTP MFA", "bcryptjs", "8h TTL JWT"],           GREEN),
        ("Authorization",    ["RBAC", "4 Role Levels", "Policy Pattern"],                      CYAN),
        ("Tenant Isolation", ["Prisma RLS", "PostgreSQL RLS", "3-Layer Isolation"],            VIOLET),
        ("Session Security", ["JTI Tracking", "Session Revocation", "CSRF Protection"],        AMBER),
        ("Data Security",    ["Encryption at Rest", "Secure Uploads", "Webhook Verification"], GREEN),
    ]
    for label, tags, color in security_rings:
        story.append(LayerRow(label, tags, color))
        story.append(Spacer(1, 4))
    story.append(PB())

    # ── SLIDE 9: COMPETITIVE ─────────────────────────────────────────────────
    story += slide_header("Competitive Moat", "Unmatched Advantages",
                          "No competitor combines all of these. This is a 3–5 year development moat.")

    compare_rows = [
        ("Workspace Versatility (10 types)", "✦ 10 industry workspaces", "Single purpose", "IT-focused", "Projects only"),
        ("Module Count",                     "✦ 32 integrated modules",  "~6",             "~12",         "~4"),
        ("Real-Time Architecture",           "✦ Socket.IO + Redis + BullMQ", "Polling",    "Partial",     "Polling"),
        ("Native AI (Agents + Memory)",      "✦ Full AI orchestration",  "Shallow bolt-on","Partial",     "None"),
        ("White-Label Ready",                "✦ Full rebrand + on-premise","No",           "Limited",     "No"),
        ("Dual Payment Providers",           "✦ Stripe + Dodo global",   "Single provider","Single provider","Single provider"),
        ("3-Layer Multi-Tenancy",            "✦ App + DB + UI isolation", "Basic",         "Partial",     "Basic"),
        ("EMS / CAD Dispatch",               "✦ Full CAD + GPS fleet",   "None",           "None",        "None"),
    ]
    story.append(CompareTable(compare_rows))
    story.append(PB())

    # ── SLIDE 10: PRICING ────────────────────────────────────────────────────
    story += slide_header("Revenue Model", "Scalable SaaS Economics",
                          "Per-seat subscriptions, enterprise licensing, white-label royalties, API access, and professional services.")

    pricing_tiers = [
        ("Starter",    "$3",      "/seat/mo",   "Small teams up to 49 seats",
         ["All core modules", "1 workspace type", "Real-time dashboards", "Basic AI assistant"],
         False),
        ("Team",       "$2.50",   "/seat/mo",   "Growing companies with 50+ seats",
         ["All modules unlocked", "Multiple workspaces", "Full AI orchestration", "White-label options"],
         True),
        ("Enterprise", "Custom",  " pricing",   "Large organizations, custom SLAs",
         ["Dedicated deployment", "Custom compliance", "On-premise option", "Full source code"],
         False),
        ("Lifetime",   "$99",     "/seat",      "One-time payment, lifetime access",
         ["No recurring fees", "All future updates", "Unlimited seats", "Priority support"],
         False),
    ]

    def pricing_cell(tier, price, sub, desc, features, featured):
        accent = CYAN if featured else MUTED
        items = [
            Paragraph(tier, ParagraphStyle("pt", fontName="Courier", fontSize=9, leading=12,
                                           textColor=MUTED, spaceAfter=4)),
            Paragraph(f'<font color="#FFFFFF">{price}</font><font color="#8888AA" size="10">{sub}</font>',
                      ParagraphStyle("pp", fontName="Helvetica-Bold", fontSize=22, leading=26,
                                     textColor=WHITE, spaceAfter=4)),
            Paragraph(desc, ParagraphStyle("pd", fontName="Helvetica", fontSize=8.5, leading=13,
                                           textColor=MUTED, spaceAfter=6)),
        ]
        for f in features:
            items.append(Paragraph(
                f'<font color="#00E89A">✓</font>  {f}',
                ParagraphStyle("pf", fontName="Helvetica", fontSize=8.5, leading=13, textColor=MUTED, spaceAfter=2)))
        return items

    pcells = [[pricing_cell(*t) for t in pricing_tiers]]
    pt = Table(pcells, colWidths=[120] * 4)
    pt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), SURFACE),
        ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#0A0A20")),
        ("BACKGROUND", (2, 0), (2, 0), SURFACE),
        ("BACKGROUND", (3, 0), (3, 0), SURFACE),
        ("BOX", (0, 0), (0, 0), 0.5, BORDER),
        ("BOX", (1, 0), (1, 0), 1, CYAN),
        ("BOX", (2, 0), (2, 0), 0.5, BORDER),
        ("BOX", (3, 0), (3, 0), 0.5, BORDER),
        ("LINEAFTER", (0, 0), (-2, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(pt)
    story.append(Spacer(1, 14))

    arr_data = [
        [Paragraph("CONSERVATIVE (500 customers)", S["mono"]),
         Paragraph("GROWTH (2,000 customers)", ParagraphStyle("gc", fontName="Courier", fontSize=8, textColor=CYAN)),
         Paragraph("PREMIUM (1K customers)", ParagraphStyle("pc2", fontName="Courier", fontSize=8, textColor=GREEN))],
        [Paragraph("$900K ARR", ParagraphStyle("av", fontName="Helvetica-Bold", fontSize=18, textColor=WHITE, alignment=TA_CENTER)),
         Paragraph("$2.16M ARR", ParagraphStyle("av2", fontName="Helvetica-Bold", fontSize=18, textColor=CYAN, alignment=TA_CENTER)),
         Paragraph("$6.0M ARR", ParagraphStyle("av3", fontName="Helvetica-Bold", fontSize=18, textColor=GREEN, alignment=TA_CENTER))],
        [Paragraph("$75K MRR", S["muted_c"]),
         Paragraph("$180K MRR", S["muted_c"]),
         Paragraph("$500K MRR", S["muted_c"])],
    ]
    arrt = Table(arr_data, colWidths=[160] * 3, rowHeights=[18, 28, 16])
    arrt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), SURFACE),
        ("BACKGROUND", (1, 0), (1, -1), colors.HexColor("#001525")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#001510")),
        ("BOX", (0, 0), (0, -1), 0.5, BORDER),
        ("BOX", (1, 0), (1, -1), 0.8, CYAN),
        ("BOX", (2, 0), (2, -1), 0.8, GREEN),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(arrt)
    story.append(PB())

    # ── SLIDE 11: ACQUISITION ────────────────────────────────────────────────
    story += slide_header("10 Reasons to Acquire", "The Case for Immediate Acquisition",
                          "Every reason alone is valuable. Combined, they represent a 3–5 year development head start worth millions.")

    acq = [
        ("01", "Complete Enterprise OS",       "Not a feature — a full platform ready to compete in a $340B category"),
        ("02", "10 Workspaces · 32 Modules",   "Multi-vertical readiness — massive TAM, diversified risk across 10 industries"),
        ("03", "Zero Legacy Debt",             "Next.js 16, React 19, TypeScript 5 — no modernization cost, pure forward momentum"),
        ("04", "Real-Time Infrastructure",     "Socket.IO + Redis + BullMQ — years of senior engineering delivered"),
        ("05", "Native AI System",             "Avoid a costly AI build project — agents, tools, memory, governance already built"),
        ("06", "Dual Payment Systems",         "Stripe + Dodo, globally ready — scale without payment friction or geographic limits"),
        ("07", "White-Label Architecture",     "License as your own product — multiple go-to-market strategies from day one"),
        ("08", "Enterprise Security",          "MFA, RLS, RBAC, audit trails — pass compliance audits without additional build"),
        ("09", "Clean Architecture",           "Service/repository pattern, full TypeScript, Zod validation — maintainable at scale"),
        ("10", "Day 1 Revenue Potential",      "Billing infrastructure, subscriptions, and payment processing ready to scale"),
    ]

    acq_rows = []
    for i in range(0, len(acq), 2):
        row = []
        for num, title, text in acq[i:i+2]:
            row.append([
                Paragraph(f'<font color="#7C5CFF" size="20">{num}</font>',
                          ParagraphStyle("anum", fontName="Helvetica-Bold", fontSize=20,
                                         leading=22, textColor=VIOLET, spaceAfter=2)),
                Paragraph(title, ParagraphStyle("atitle", fontName="Helvetica-Bold", fontSize=10,
                                                leading=14, textColor=WHITE, spaceAfter=2)),
                Paragraph(text, ParagraphStyle("atext", fontName="Helvetica", fontSize=9,
                                               leading=13, textColor=MUTED)),
            ])
        while len(row) < 2:
            row.append("")
        acq_rows.append(row)

    aqt = Table(acq_rows, colWidths=[240, 240])
    aqt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
    ]))
    story.append(aqt)
    story.append(PB())

    # ── SLIDE 12: VALUATION + CTA ────────────────────────────────────────────
    story += [
        Spacer(1, 10),
        Paragraph("ESTIMATED VALUATION", S["eyebrow_c"]),
        Paragraph("Ready to Own the\nEnterprise OS Category?",
                  ParagraphStyle("cta_h", fontName="Helvetica-Bold", fontSize=30, leading=34,
                                 textColor=WHITE, alignment=TA_CENTER, spaceAfter=8)),
        Paragraph("Acquire Taskit OS and instantly lead a $340B market. The platform is complete. The infrastructure is built. The opportunity is now.",
                  ParagraphStyle("cta_sub", fontName="Helvetica", fontSize=11, leading=16,
                                 textColor=MUTED, alignment=TA_CENTER, spaceAfter=20)),
    ]

    val_data = [[
        [Paragraph("Assets + Code", S["mono_c"]),
         Paragraph("$80k", ParagraphStyle("vm", fontName="Helvetica-Bold", fontSize=22, textColor=WHITE, alignment=TA_CENTER)),
         Paragraph("Low $60k · High $100k", S["muted_c"])],
        [Paragraph("With Customer Base", S["mono_c"]),
         Paragraph("$200k", ParagraphStyle("vm2", fontName="Helvetica-Bold", fontSize=22, textColor=WHITE, alignment=TA_CENTER)),
         Paragraph("Low $150k · High $250k", S["muted_c"])],
        [Paragraph("Strategic Acquirer", ParagraphStyle("vsc", fontName="Courier", fontSize=8, textColor=CYAN, alignment=TA_CENTER)),
         Paragraph("$300k", ParagraphStyle("vm3", fontName="Helvetica-Bold", fontSize=22, textColor=CYAN, alignment=TA_CENTER)),
         Paragraph("Low $250k · High $400k+", S["muted_c"])],
        [Paragraph("With Revenue Growth", S["mono_c"]),
         Paragraph("$1M", ParagraphStyle("vm4", fontName="Helvetica-Bold", fontSize=22, textColor=WHITE, alignment=TA_CENTER)),
         Paragraph("Low $400k · High $5M+", S["muted_c"])],
    ]]
    vt = Table(val_data, colWidths=[120] * 4)
    vt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (1, 0), SURFACE),
        ("BACKGROUND", (2, 0), (2, 0), colors.HexColor("#001525")),
        ("BACKGROUND", (3, 0), (3, 0), SURFACE),
        ("BOX", (0, 0), (1, 0), 0.5, BORDER),
        ("BOX", (2, 0), (2, 0), 1, CYAN),
        ("BOX", (3, 0), (3, 0), 0.5, BORDER),
        ("LINEAFTER", (0, 0), (-2, -1), 0.4, BORDER),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(vt)
    story.append(Spacer(1, 20))

    story.append(Paragraph("WHAT YOU GET WITH ACQUISITION", S["eyebrow_c"]))
    story.append(Spacer(1, 8))

    deliverables = [
        ("Full source code and complete IP ownership",    "713+ source files, fully documented TypeScript"),
        ("Database schema and all migration scripts",     "CI/CD pipeline and deployment configuration"),
        ("All integrations and API contracts (43 groups)", "AI agent configurations and governance system"),
        ("Brand assets and complete design system",       "30-day knowledge transfer and onboarding"),
    ]
    for l, r in deliverables:
        d_data = [[
            Paragraph(f'<font color="#00C8F0">→</font>  {l}', S["body"]),
            Paragraph(f'<font color="#00C8F0">→</font>  {r}', S["body"]),
        ]]
        dt = Table(d_data, colWidths=[240, 240])
        dt.setStyle(TableStyle([
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(dt)

    story.append(Spacer(1, 20))
    story.append(ColorBar(CYAN, height=1))
    story.append(Spacer(1, 12))
    story.append(Paragraph("TASKIT OS · THE UNIFIED ENTERPRISE OPERATING SYSTEM",
                           ParagraphStyle("footer", fontName="Helvetica-Bold", fontSize=9,
                                          leading=12, textColor=DIM, alignment=TA_CENTER)))
    story.append(Paragraph("10 Workspaces · 32 Modules · One Platform · Ready for Acquisition",
                           ParagraphStyle("footer2", fontName="Courier", fontSize=8, leading=12,
                                          textColor=DIM, alignment=TA_CENTER)))
    story.append(Paragraph("acquisition@taskitos.com  ·  demo@taskitos.com",
                           ParagraphStyle("contacts", fontName="Helvetica", fontSize=9, leading=14,
                                          textColor=CYAN, alignment=TA_CENTER, spaceAfter=0)))

    return story


# ── BUILD PDF ─────────────────────────────────────────────────────────────────
output_path = "/mnt/user-data/outputs/taskit-os-pitch-deck.pdf"

doc = SimpleDocTemplate(
    output_path,
    pagesize=A4,
    leftMargin=22 * mm,
    rightMargin=22 * mm,
    topMargin=18 * mm,
    bottomMargin=16 * mm,
)

story = build_story()
doc.build(story, onFirstPage=dark_bg, onLaterPages=dark_bg)
print(f"PDF written to {output_path}")