import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface DealVaultCertificateInput {
  certificateId: string;
  dealId?: string | null;
  proofId?: string | null;
  dealType?: string | null;
  documentHash: string;
  propertyHash?: string | null;
  createdAt: string;
  blockchainNetwork?: string | null;
  contractAddress?: string | null;
  transactionHash?: string | null;
  verificationStatus?: string | null;
}

type CertificatePalette = {
  page: ReturnType<typeof rgb>;
  panel: ReturnType<typeof rgb>;
  panelText: ReturnType<typeof rgb>;
  heading: ReturnType<typeof rgb>;
  label: ReturnType<typeof rgb>;
  body: ReturnType<typeof rgb>;
  subtle: ReturnType<typeof rgb>;
  border: ReturnType<typeof rgb>;
  card: ReturnType<typeof rgb>;
  accent: ReturnType<typeof rgb>;
};

function normalizeValue(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : "N/A";
}

function formatCertificateDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return `${parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })} ${parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
}

function splitLongToken(token: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const chunks: string[] = [];
  let current = "";

  for (const char of token) {
    const next = `${current}${char}`;
    if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
      current = next;
      continue;
    }

    if (current) chunks.push(current);
    current = char;
  }

  if (current) chunks.push(current);
  return chunks.length ? chunks : [token];
}

function wrapTextByWidth(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const safeText = normalizeValue(text);
  const tokens = safeText.split(/\s+/).flatMap((token) => {
    if (font.widthOfTextAtSize(token, fontSize) <= maxWidth) return [token];
    return splitLongToken(token, font, fontSize, maxWidth);
  });

  const lines: string[] = [];
  let current = "";

  for (const token of tokens) {
    const next = current ? `${current} ${token}` : token;
    if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
      current = next;
      continue;
    }

    if (current) lines.push(current);
    current = token;
  }

  if (current) lines.push(current);
  return lines.length ? lines : ["N/A"];
}

function drawWrappedText(
  page: PDFPage,
  lines: string[],
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  lineHeight: number,
  color: ReturnType<typeof rgb>
) {
  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - index * lineHeight,
      size,
      font,
      color,
    });
  });
}

function drawSectionCard(
  page: PDFPage,
  input: {
    x: number;
    y: number;
    width: number;
    title: string;
    entries: Array<{ label: string; value: string; monospaced?: boolean }>;
    fonts: { sans: PDFFont; sansBold: PDFFont; mono: PDFFont };
    palette: CertificatePalette;
  }
) {
  const sectionPadding = 14;
  const sectionTitleSize = 10;
  const labelSize = 8.8;
  const valueLineHeight = 11;
  const cardWidth = input.width;
  const contentWidth = cardWidth - sectionPadding * 2;
  let currentY = input.y - 18;

  const measured = input.entries.map((entry) => {
    const valueFont = entry.monospaced ? input.fonts.mono : input.fonts.sans;
    const valueSize = entry.monospaced ? 8.6 : 9.6;
    const lines = wrapTextByWidth(entry.value, valueFont, valueSize, contentWidth);
    const blockHeight = 14 + lines.length * valueLineHeight + 8;
    return { ...entry, valueFont, valueSize, lines, blockHeight };
  });

  const height =
    26 + measured.reduce((sum, entry) => sum + entry.blockHeight, 0) + sectionPadding;

  page.drawRectangle({
    x: input.x,
    y: input.y - height,
    width: cardWidth,
    height,
    color: input.palette.card,
    borderColor: input.palette.border,
    borderWidth: 1,
  });

  page.drawText(input.title, {
    x: input.x + sectionPadding,
    y: input.y - 18,
    size: sectionTitleSize,
    font: input.fonts.sansBold,
    color: input.palette.label,
  });

  currentY -= 18;

  measured.forEach((entry, index) => {
    page.drawText(entry.label, {
      x: input.x + sectionPadding,
      y: currentY,
      size: labelSize,
      font: input.fonts.sansBold,
      color: input.palette.label,
    });

    drawWrappedText(
      page,
      entry.lines,
      input.x + sectionPadding,
      currentY - 14,
      entry.valueFont,
      entry.valueSize,
      valueLineHeight,
      input.palette.body
    );

    currentY -= entry.blockHeight;

    if (index < measured.length - 1) {
      page.drawLine({
        start: { x: input.x + sectionPadding, y: currentY + 4 },
        end: { x: input.x + cardWidth - sectionPadding, y: currentY + 4 },
        thickness: 1,
        color: input.palette.border,
      });
    }
  });

  return height + 12;
}

export async function generateDealVaultCertificatePdf(input: DealVaultCertificateInput) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([792, 612]);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  const palette: CertificatePalette = {
    page: rgb(0.962, 0.969, 0.984),
    panel: rgb(0.082, 0.109, 0.176),
    panelText: rgb(0.906, 0.937, 0.984),
    heading: rgb(1, 1, 1),
    label: rgb(0.262, 0.349, 0.474),
    body: rgb(0.086, 0.117, 0.188),
    subtle: rgb(0.384, 0.462, 0.572),
    border: rgb(0.812, 0.859, 0.922),
    card: rgb(1, 1, 1),
    accent: rgb(0.722, 0.824, 0.949),
  };

  page.drawRectangle({
    x: 24,
    y: 24,
    width: 744,
    height: 564,
    color: palette.page,
  });

  page.drawRectangle({
    x: 40,
    y: 438,
    width: 712,
    height: 134,
    color: palette.panel,
  });

  page.drawText("DealVault by VestBlock", {
    x: 60,
    y: 540,
    size: 10,
    font: sansBold,
    color: palette.accent,
  });

  page.drawText("Blockchain-Backed Agreement Proof Certificate", {
    x: 60,
    y: 506,
    size: 24,
    font: sansBold,
    color: palette.heading,
  });

  page.drawText(
    "This certificate verifies that a document or deal proof record was created and timestamped through DealVault.",
    {
      x: 60,
      y: 482,
      size: 11,
      font: sans,
      color: palette.panelText,
      maxWidth: 500,
      lineHeight: 14,
    }
  );

  const fonts = { sans, sansBold, mono };
  const leftTopY = 408;
  const rightTopY = 408;

  const leftFirstHeight = drawSectionCard(page, {
    x: 56,
    y: leftTopY,
    width: 278,
    title: "Record Summary",
    entries: [
      { label: "Certificate ID", value: input.certificateId, monospaced: true },
      { label: "Deal ID", value: input.dealId || "", monospaced: true },
      { label: "Proof ID", value: input.proofId || "", monospaced: true },
    ],
    fonts,
    palette,
  });

  drawSectionCard(page, {
    x: 56,
    y: leftTopY - leftFirstHeight,
    width: 278,
    title: "Deal Summary",
    entries: [
      { label: "Deal Type", value: input.dealType || "" },
      { label: "Created At", value: formatCertificateDate(input.createdAt) },
      { label: "Verification Status", value: input.verificationStatus || "" },
    ],
    fonts,
    palette,
  });

  const rightFirstHeight = drawSectionCard(page, {
    x: 350,
    y: rightTopY,
    width: 386,
    title: "Hash Anchors",
    entries: [
      { label: "Document Hash", value: input.documentHash, monospaced: true },
      { label: "Property Hash", value: input.propertyHash || "", monospaced: true },
    ],
    fonts,
    palette,
  });

  drawSectionCard(page, {
    x: 350,
    y: rightTopY - rightFirstHeight,
    width: 386,
    title: "Chain Reference",
    entries: [
      { label: "Blockchain Network", value: input.blockchainNetwork || "" },
      { label: "Contract Address", value: input.contractAddress || "", monospaced: true },
      { label: "Transaction Hash", value: input.transactionHash || "", monospaced: true },
    ],
    fonts,
    palette,
  });

  page.drawText(
    "This certificate verifies a digital proof record only. It does not validate legal enforceability, ownership, title, escrow status, or regulatory compliance.",
    {
      x: 60,
      y: 102,
      size: 10,
      font: sans,
      color: palette.label,
      maxWidth: 430,
      lineHeight: 14,
    }
  );

  page.drawText(
    "DealVault helps track and prove agreement records. It does not replace legal counsel, licensed title services, escrow services, brokerage compliance, or required real estate professionals.",
    {
      x: 60,
      y: 60,
      size: 9,
      font: sans,
      color: palette.subtle,
      maxWidth: 430,
      lineHeight: 13,
    }
  );

  page.drawRectangle({
    x: 548,
    y: 72,
    width: 164,
    height: 116,
    borderColor: rgb(0.56, 0.659, 0.78),
    borderWidth: 1,
  });

  page.drawText("Verification QR", {
    x: 592,
    y: 142,
    size: 12,
    font: sansBold,
    color: palette.label,
  });

  page.drawText("placeholder", {
    x: 604,
    y: 124,
    size: 10,
    font: sans,
    color: palette.subtle,
  });

  page.drawLine({
    start: { x: 568, y: 96 },
    end: { x: 694, y: 96 },
    thickness: 1,
    color: palette.border,
  });

  page.drawText("VestBlock Signature Block", {
    x: 574,
    y: 80,
    size: 10,
    font: sansBold,
    color: palette.body,
  });

  return pdf.save();
}
