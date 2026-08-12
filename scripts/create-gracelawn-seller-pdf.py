from __future__ import annotations

from pathlib import Path
from textwrap import wrap

from PIL import Image, ImageOps
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    Image as RLImage,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path("/Users/mrsanders/Downloads/Codex Folder")
IMG_DIR = ROOT / "tmp/gracelawn_pdf_images"
OUT = ROOT / "output/pdf/gracelawn-house-plus-lots-seller-analysis.pdf"

PAGE_W, PAGE_H = letter
MARGIN = 0.48 * inch
ACCENT = colors.HexColor("#0F766E")
DARK = colors.HexColor("#17211F")
MUTED = colors.HexColor("#5F6F6B")
LIGHT = colors.HexColor("#E8F3F1")
PALE = colors.HexColor("#F6FAF9")
WARN = colors.HexColor("#8A4B10")


def image_box(path: Path, width: float, height: float, caption: str = ""):
    """Return a cropped image block that fits inside a fixed box."""
    prepared = ROOT / "tmp/pdfs" / f"{path.stem}_{int(width)}x{int(height)}.jpg"
    prepared.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(path).convert("RGB")
    im = ImageOps.exif_transpose(im)
    src_ratio = im.width / im.height
    dst_ratio = width / height
    if src_ratio > dst_ratio:
        new_w = int(im.height * dst_ratio)
        left = (im.width - new_w) // 2
        im = im.crop((left, 0, left + new_w, im.height))
    else:
        new_h = int(im.width / dst_ratio)
        top = (im.height - new_h) // 2
        im = im.crop((0, top, im.width, top + new_h))
    im = im.resize((int(width * 2), int(height * 2)))
    im.save(prepared, quality=88)
    block = [[RLImage(str(prepared), width=width, height=height)]]
    if caption:
        block.append([Paragraph(caption, styles()["Caption"])])
    tbl = Table(block, colWidths=[width])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, 0), 0.4, colors.HexColor("#D6E2DF")),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return tbl


def styles():
    base = getSampleStyleSheet()
    base.add(ParagraphStyle(
        name="Deck",
        fontName="Helvetica",
        fontSize=11,
        leading=15,
        textColor=MUTED,
        spaceAfter=8,
    ))
    base.add(ParagraphStyle(
        name="Section",
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=DARK,
        spaceBefore=12,
        spaceAfter=7,
    ))
    base.add(ParagraphStyle(
        name="BodySmall",
        fontName="Helvetica",
        fontSize=9.5,
        leading=13,
        textColor=DARK,
    ))
    base.add(ParagraphStyle(
        name="Callout",
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=14,
        textColor=DARK,
    ))
    base.add(ParagraphStyle(
        name="Tiny",
        fontName="Helvetica",
        fontSize=7.4,
        leading=9,
        textColor=MUTED,
    ))
    base.add(ParagraphStyle(
        name="Caption",
        fontName="Helvetica",
        fontSize=7.7,
        leading=9.5,
        textColor=MUTED,
        alignment=1,
    ))
    return base


S = styles()


def p(text: str, style: str = "BodySmall"):
    return Paragraph(text, S[style])


def table(data, widths, header=True):
    t = Table(data, colWidths=widths, hAlign="LEFT", repeatRows=1 if header else 0)
    style = [
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBDAD6")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        style += [
            ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ]
    for row in range(1, len(data)):
        if row % 2 == 0:
            style.append(("BACKGROUND", (0, row), (-1, row), PALE))
    t.setStyle(TableStyle(style))
    return t


def draw_header_footer(c: canvas.Canvas, doc):
    c.saveState()
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN, PAGE_H - 0.32 * inch, "VestBlock preliminary seller analysis")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.5)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 0.32 * inch, "North Flint house + 3-lot package")
    c.line(MARGIN, PAGE_H - 0.4 * inch, PAGE_W - MARGIN, PAGE_H - 0.4 * inch)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.2)
    c.drawString(MARGIN, 0.28 * inch, "Preliminary only. Final pricing depends on title, taxes, parcel boundaries, zoning, access, code issues, and buyer inspection.")
    c.drawRightString(PAGE_W - MARGIN, 0.28 * inch, f"Page {doc.page}")
    c.restoreState()


def lot_diagram():
    path = ROOT / "tmp/pdfs/gracelawn-lot-layout-estimate.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    w, h = 1200, 620
    im = Image.new("RGB", (w, h), "white")
    from PIL import ImageDraw, ImageFont
    d = ImageDraw.Draw(im)
    try:
        font_b = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 38)
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 26)
        tiny = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 22)
    except Exception:
        font_b = font = tiny = None
    d.rounded_rectangle((30, 30, 1170, 590), radius=26, outline=(203, 218, 214), width=3, fill=(247, 251, 250))
    d.text((55, 55), "Estimated Lot Package - Subject to GIS/Title Verification", fill=(23, 33, 31), font=font_b)
    labels = [
        ("Side Lot", "approx 4,182 sq ft"),
        ("House Parcel", "approx 4,182 sq ft"),
        ("Side Lot", "approx 4,182 sq ft"),
    ]
    x = 80
    for i, (label, size) in enumerate(labels):
        fill = (232, 243, 241) if i != 1 else (215, 235, 231)
        d.rounded_rectangle((x, 165, x + 280, 425), radius=16, outline=(15, 118, 110), width=4, fill=fill)
        d.text((x + 55, 235), label, fill=(23, 33, 31), font=font_b if i == 1 else font)
        d.text((x + 48, 285), size, fill=(95, 111, 107), font=tiny)
        x += 300
    d.rounded_rectangle((965, 190, 1135, 385), radius=16, outline=(138, 75, 16), width=4, fill=(255, 247, 237))
    d.text((990, 235), "Separate", fill=(138, 75, 16), font=font)
    d.text((1018, 270), "Lot", fill=(138, 75, 16), font=font)
    d.text((982, 320), "approx 4,182", fill=(95, 111, 107), font=tiny)
    d.text((1026, 348), "sq ft", fill=(95, 111, 107), font=tiny)
    d.text((120, 455), "Joined/adjacent footprint: approx 12,546 sq ft / 0.29 acre", fill=(15, 118, 110), font=font_b)
    d.text((120, 505), "Total package estimate: approx 16,728 sq ft / 0.38 acre", fill=(95, 111, 107), font=tiny)
    im.save(path)
    return path


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        rightMargin=MARGIN,
        leftMargin=MARGIN,
        topMargin=0.62 * inch,
        bottomMargin=0.55 * inch,
    )
    story = []

    title_style = ParagraphStyle(
        name="Title",
        fontName="Helvetica-Bold",
        fontSize=26,
        leading=30,
        textColor=DARK,
        spaceAfter=8,
    )
    story.append(Paragraph("North Flint House + 3-Lot Package", title_style))
    story.append(p("Seller-facing pricing support packet | Preliminary analysis prepared by VestBlock | July 2026", "Deck"))
    story.append(Table(
        [[
            p("Target buyer-interest range<br/><font color='#0F766E'><b>$20,000 - $25,000</b></font>", "Callout"),
            p("Estimated stabilized ARV<br/><font color='#0F766E'><b>$55,000 - $65,000</b></font>", "Callout"),
            p("Estimated rehab exposure<br/><font color='#8A4B10'><b>$55,000 - $85,000+</b></font>", "Callout"),
        ]],
        colWidths=[2.35 * inch, 2.35 * inch, 2.35 * inch],
        style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#BFD8D3")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ]),
    ))
    story.append(Spacer(1, 10))
    story.append(p("<b>Plain-English read:</b> the package is interesting because of the land setup, not because the house is a light rehab. The house appears to need a full renovation and the extra parcels must be verified before any buyer can treat the land value as real. A $20k-$25k buyer-testing range is aggressive enough to respect the package, while still leaving room for taxes, title cleanup, rehab risk, and buyer profit.", "BodySmall"))
    story.append(Spacer(1, 8))
    story.append(Table(
        [[
            image_box(IMG_DIR / "IMG_3113.jpg", 3.35 * inch, 2.28 * inch, "Front/exterior context from seller photos"),
            image_box(IMG_DIR / "IMG_1915.jpg", 3.35 * inch, 2.28 * inch, "Side/yard context showing overgrowth and lot condition"),
        ]],
        colWidths=[3.45 * inch, 3.45 * inch],
        style=TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]),
    ))
    story.append(Spacer(1, 10))
    story.append(p("Seller-provided package: one vacant 2 bed / 1 bath house plus three additional lots. Seller states two of the lots are adjacent/connected to the house package and one lot is separate. Back taxes and final title/ownership details still need confirmation.", "BodySmall"))

    story.append(PageBreak())
    story.append(p("Lot Package Estimate", "Section"))
    story.append(RLImage(str(lot_diagram()), width=7.1 * inch, height=3.66 * inch))
    story.append(Spacer(1, 8))
    story.append(table([
        [p("Component", "Callout"), p("Estimated Size", "Callout"), p("Notes", "Callout")],
        [p("House parcel", "BodySmall"), p("approx 4,182 sq ft", "BodySmall"), p("Public records show the house parcel near 0.10 acre. Exact boundary must be verified.", "BodySmall")],
        [p("Two connected/adjacent lots", "BodySmall"), p("approx 8,364 sq ft combined", "BodySmall"), p("Assumes each small lot is roughly the same 4,182 sq ft size seen in nearby parcel records.", "BodySmall")],
        [p("Joined house + adjacent-lot footprint", "BodySmall"), p("approx 12,546 sq ft / 0.29 acre", "BodySmall"), p("This is the strongest part of the story if GIS/title confirms contiguity and access.", "BodySmall")],
        [p("Separate nearby lot", "BodySmall"), p("approx 4,182 sq ft / 0.10 acre", "BodySmall"), p("Separate lot value is likely modest unless a neighbor, grower, builder, or land buyer has a specific use.", "BodySmall")],
        [p("Total package", "BodySmall"), p("approx 16,728 sq ft / 0.38 acre", "BodySmall"), p("Treat as an estimate until county GIS, taxes, and title are verified.", "BodySmall")],
    ], [1.6 * inch, 1.65 * inch, 3.85 * inch]))

    story.append(p("Photo Review", "Section"))
    story.append(Table(
        [[
            image_box(IMG_DIR / "IMG_4397.jpg", 2.25 * inch, 1.6 * inch, "Exterior/yard condition"),
            image_box(IMG_DIR / "IMG_3800.jpg", 2.25 * inch, 1.6 * inch, "Side elevation and openings"),
            image_box(IMG_DIR / "IMG_2290.jpg", 2.25 * inch, 1.6 * inch, "Door/access condition"),
        ],
        [
            image_box(IMG_DIR / "IMG_6085.jpg", 2.25 * inch, 1.6 * inch, "Kitchen rehab scope"),
            image_box(IMG_DIR / "IMG_1148.jpg", 2.25 * inch, 1.6 * inch, "Bathroom rehab scope"),
            image_box(IMG_DIR / "IMG_9545.jpg", 2.25 * inch, 1.6 * inch, "Mechanical/basement review needed"),
        ]],
        colWidths=[2.34 * inch, 2.34 * inch, 2.34 * inch],
        style=TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]),
    ))
    story.append(Spacer(1, 8))
    story.append(p("<b>Condition summary:</b> photos support a full-rehab underwriting posture: trash-out, interior finish replacement, kitchen/bath work, broken/open windows or doors, exterior cleanup, and mechanical/electrical/plumbing verification. Roof, foundation, utilities, tax balance, code status, and title still need final confirmation.", "BodySmall"))

    story.append(p("ARV And Comp Support", "Section"))
    story.append(p("The higher-end ARV should be used as a ceiling, not a promise. A finished, rent-ready small home in this part of Flint can support low-to-mid $50k value, with stronger nearby listings and AVM references supporting a possible $55k-$65k optimistic ceiling if the finished product is clean and the land story is useful.", "BodySmall"))
    story.append(Spacer(1, 6))
    story.append(table([
        [p("Comp / Source", "Callout"), p("Indicator", "Callout"), p("How It Supports Value", "Callout")],
        [p("Subject public estimate", "BodySmall"), p("Realtor estimate around $46.9k; 2/1, 763 sq ft", "BodySmall"), p("Supports a mid-$40k baseline before giving credit for extra lots or strong rehab finish.", "BodySmall")],
        [p("412 W Gracelawn", "BodySmall"), p("Listed/pending around $44.9k; small Flint home", "BodySmall"), p("Nearby Gracelawn reference; supports market appetite around the mid-$40k range for livable product.", "BodySmall")],
        [p("48505 active/listing set", "BodySmall"), p("Examples in the $49.9k-$51k range for small homes", "BodySmall"), p("Supports low-$50k stabilized range when condition is materially better than subject.", "BodySmall")],
        [p("Higher upside references", "BodySmall"), p("Some 48505 small-home listings/AVMs show $60k-$70k+ outliers", "BodySmall"), p("Useful only as an optimistic ceiling; not a base-case offer anchor due to rehab condition.", "BodySmall")],
    ], [1.55 * inch, 2.15 * inch, 3.4 * inch]))

    story.append(p("Rehab Budget View", "Section"))
    story.append(table([
        [p("Scope Area", "Callout"), p("Likely Range", "Callout"), p("Notes", "Callout")],
        [p("Trash-out, boarding, yard/code cleanup", "BodySmall"), p("$5k - $12k", "BodySmall"), p("Includes debris, overgrowth, securing openings, and basic exterior cleanup.", "BodySmall")],
        [p("Windows/doors/exterior repairs", "BodySmall"), p("$8k - $18k", "BodySmall"), p("Broken/open windows and access points visible. Roof/siding not fully verified.", "BodySmall")],
        [p("Kitchen/bath/interior finishes", "BodySmall"), p("$18k - $35k", "BodySmall"), p("Kitchen and bath appear to need substantial rebuild-level work.", "BodySmall")],
        [p("Flooring/drywall/paint/subfloor allowance", "BodySmall"), p("$15k - $30k", "BodySmall"), p("Visible floor and wall damage; hidden subfloor issues could push higher.", "BodySmall")],
        [p("MEP systems and utility activation", "BodySmall"), p("$15k - $35k+", "BodySmall"), p("Mechanical, electrical, plumbing, HVAC, and utility status must be inspected.", "BodySmall")],
        [p("Base rehab estimate", "BodySmall"), p("$55k - $85k+", "BodySmall"), p("Could exceed this if roof, foundation, utility, or code issues are worse than photos show.", "BodySmall")],
    ], [2.15 * inch, 1.3 * inch, 3.65 * inch]))

    story.append(p("Pricing Logic", "Section"))
    story.append(Table(
        [[
            p("<b>Recommended buyer-test range:</b><br/><font color='#0F766E'><b>$20,000 - $25,000</b></font><br/><br/>This is the number range to float while buyer demand is being tested. It is not final until taxes/title/parcels/code and buyer inspection are confirmed.", "BodySmall"),
            p("<b>Why this range makes sense:</b><br/>A buyer who pays $20k-$25k may still be all-in near $80k-$110k after rehab, taxes, holding costs, and closing. That is tight against a $55k-$65k ARV unless the land package creates extra value or the buyer has a very specific plan.", "BodySmall"),
        ]],
        colWidths=[3.45 * inch, 3.45 * inch],
        style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF7ED")),
            ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#E6B980")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ]),
    ))
    story.append(Spacer(1, 8))
    story.append(p("<b>Best-fit buyer routes:</b> local cash buyer, heavy-rehab landlord, small builder/infill operator, neighborhood rebuild program, or land assemblage buyer. DSCR/rental financing is not the primary route because the rehab load likely pushes the all-in basis above what the rent and value can support.", "BodySmall"))

    story.append(p("Open Items Before Final Offer", "Section"))
    story.append(table([
        [p("Item", "Callout"), p("Why It Matters", "Callout")],
        [p("Back-tax balance", "BodySmall"), p("Directly affects net price and buyer closing risk.", "BodySmall")],
        [p("Clean title / brother ownership structure", "BodySmall"), p("Seller mentioned family names tied to lots. All required signatures must be confirmed.", "BodySmall")],
        [p("Parcel contiguity and access", "BodySmall"), p("The connected-lot story is the main upside. It must match GIS/title reality.", "BodySmall")],
        [p("Code, liens, utilities, water/sewer", "BodySmall"), p("Could materially change rehab cost and buyer appetite.", "BodySmall")],
        [p("Interior access / contractor walkthrough", "BodySmall"), p("Needed before any buyer treats rehab numbers as firm.", "BodySmall")],
    ], [2.4 * inch, 4.7 * inch]))
    story.append(Spacer(1, 8))
    story.append(p("<b>Sources checked:</b> Zillow subject facts, Realtor subject estimate, Compass public parcel/lot-size reference, nearby Realtor/Redfin/Zillow listings and market snippets for 48505. Public data conflicts in places, so title/GIS/tax verification controls final underwriting.", "Tiny"))

    doc.build(story, onFirstPage=draw_header_footer, onLaterPages=draw_header_footer)
    print(OUT)


if __name__ == "__main__":
    build()
