import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

type DeploymentRecord = {
  contracts?: {
    proofVault?: string;
  };
};

type LiveProofRecord = {
  transactionHash?: string;
};

const root = process.cwd();
const pdfPath = resolve(root, "public/dealvault/demo-agreement.pdf");
const packagePath = resolve(root, "deployments/dealvault-demo-package.json");
const polygonDeploymentPath = resolve(root, "deployments/polygon.json");
const polygonLiveProofPath = resolve(root, "deployments/polygon.live-proof.json");

const disclaimer =
  "This sample is for product demonstration only. It is not legal advice, does not replace legal counsel, title, escrow, brokerage compliance, or required written agreements.";
const demoDocumentDate = new Date("2026-05-09T00:00:00.000Z");

const parties = [
  "VestBlock Demo Client LLC",
  "Northstar Referral Partners LLC",
  "Apex Milestone Services LLC",
];

type DrawContext = {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
  pageNumber: number;
};

function drawFooter(ctx: DrawContext) {
  const { page, font, pageNumber } = ctx;
  page.drawLine({
    start: { x: 54, y: 54 },
    end: { x: 558, y: 54 },
    thickness: 0.6,
    color: rgb(0.78, 0.84, 0.88),
  });
  page.drawText("DealVault demo agreement - sample only", {
    x: 54,
    y: 36,
    size: 8,
    font,
    color: rgb(0.35, 0.4, 0.48),
  });
  page.drawText(`Page ${pageNumber}`, {
    x: 520,
    y: 36,
    size: 8,
    font,
    color: rgb(0.35, 0.4, 0.48),
  });
}

function addPage(ctx: DrawContext) {
  drawFooter(ctx);
  ctx.page = ctx.doc.addPage([612, 792]);
  ctx.pageNumber += 1;
  ctx.y = 724;
}

function splitText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines;
}

function ensureSpace(ctx: DrawContext, needed: number) {
  if (ctx.y - needed < 78) {
    addPage(ctx);
  }
}

function drawWrappedText(
  ctx: DrawContext,
  text: string,
  options: {
    x?: number;
    size?: number;
    lineHeight?: number;
    maxWidth?: number;
    color?: ReturnType<typeof rgb>;
    font?: PDFFont;
  } = {}
) {
  const x = options.x ?? 72;
  const size = options.size ?? 10.5;
  const lineHeight = options.lineHeight ?? 15;
  const maxWidth = options.maxWidth ?? 468;
  const font = options.font ?? ctx.font;
  const color = options.color ?? rgb(0.12, 0.16, 0.22);
  const lines = splitText(text, font, size, maxWidth);

  ensureSpace(ctx, lines.length * lineHeight + 4);

  for (const line of lines) {
    ctx.page.drawText(line, { x, y: ctx.y, size, font, color });
    ctx.y -= lineHeight;
  }
}

function drawSection(ctx: DrawContext, title: string, body: string[]) {
  ensureSpace(ctx, 52);
  ctx.y -= 10;
  ctx.page.drawText(title, {
    x: 72,
    y: ctx.y,
    size: 13,
    font: ctx.bold,
    color: rgb(0.02, 0.3, 0.42),
  });
  ctx.y -= 22;

  for (const paragraph of body) {
    drawWrappedText(ctx, paragraph);
    ctx.y -= 7;
  }
}

function drawBulletList(ctx: DrawContext, title: string, bullets: string[]) {
  ensureSpace(ctx, 52);
  ctx.y -= 8;
  ctx.page.drawText(title, {
    x: 72,
    y: ctx.y,
    size: 12,
    font: ctx.bold,
    color: rgb(0.1, 0.2, 0.27),
  });
  ctx.y -= 20;

  for (const bullet of bullets) {
    drawWrappedText(ctx, `- ${bullet}`, { x: 84, maxWidth: 448 });
    ctx.y -= 4;
  }
}

async function createDemoAgreementPdf() {
  mkdirSync(dirname(pdfPath), { recursive: true });

  const doc = await PDFDocument.create();
  doc.setTitle("DealVault Demo Agreement");
  doc.setAuthor("VestBlock");
  doc.setSubject("Sample Referral, Proof Record, and Milestone Tracking Agreement");
  doc.setKeywords(["DealVault", "VestBlock", "demo", "proof records"]);
  doc.setCreator("VestBlock DealVault demo package generator");
  doc.setProducer("pdf-lib");
  doc.setCreationDate(demoDocumentDate);
  doc.setModificationDate(demoDocumentDate);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: DrawContext = {
    doc,
    page: doc.addPage([612, 792]),
    font,
    bold,
    y: 724,
    pageNumber: 1,
  };

  ctx.page.drawRectangle({
    x: 0,
    y: 690,
    width: 612,
    height: 102,
    color: rgb(0.02, 0.12, 0.17),
  });
  ctx.page.drawText("DealVault Demo Agreement", {
    x: 54,
    y: 746,
    size: 25,
    font: bold,
    color: rgb(0.88, 0.98, 1),
  });
  ctx.page.drawText("Sample Referral, Proof Record, and Milestone Tracking Agreement", {
    x: 54,
    y: 718,
    size: 11,
    font,
    color: rgb(0.58, 0.9, 0.96),
  });

  ctx.y = 658;
  drawWrappedText(ctx, "Demo parties", {
    size: 9,
    font: bold,
    color: rgb(0.02, 0.3, 0.42),
  });
  ctx.y -= 2;
  for (const party of parties) {
    drawWrappedText(ctx, party, { x: 84, size: 10.5 });
  }

  drawSection(ctx, "1. Purpose", [
    "This sample agreement shows how a business can use DealVault to organize an agreement record, attach proof of a document, track referral or payout splits, and follow milestone status in a clean audit trail.",
    "The sample is intentionally fictional. It is designed for sales demos, internal product walkthroughs, and buyer education.",
  ]);

  drawSection(ctx, "2. Deal record summary", [
    "The parties agree to create a DealVault demo record called Demo Agreement Record DV-2026-001. The record may include an internal deal ID, proof ID, timestamp, status, and external reference.",
    "No raw property address, private contract text, personal identity data, bank information, or sensitive business records are intended to be placed on-chain.",
  ]);

  drawBulletList(ctx, "Demo record fields", [
    "Demo deal ID: DV-DEMO-2026-001",
    "Agreement category: referral, proof record, and milestone tracking",
    "Record status: sample active",
    "External reference: dealvault-demo-agreement-2026",
  ]);

  drawSection(ctx, "3. Referral and payout tracking", [
    "Northstar Referral Partners LLC is shown as a referral partner for demonstration purposes. DealVault may record payout split names, percentages, approval status, and paid status for operational visibility.",
    "This demo does not move funds, hold escrow, custody assets, guarantee payment, or replace payment processors, title companies, accountants, or legal professionals.",
  ]);

  drawBulletList(ctx, "Sample payout split", [
    "VestBlock Demo Client LLC: 70 percent allocation for the demo owner",
    "Northstar Referral Partners LLC: 20 percent referral allocation",
    "Apex Milestone Services LLC: 10 percent milestone services allocation",
  ]);

  drawSection(ctx, "4. Milestone tracking", [
    "Apex Milestone Services LLC is shown as a service provider responsible for submitting milestone updates. The demo record may track submitted, approved, disputed, or completed status changes.",
    "Milestone records are for project visibility. They do not guarantee quality, payment, compliance, or completion unless separately agreed in proper written agreements.",
  ]);

  drawBulletList(ctx, "Sample milestones", [
    "Milestone 1: Agreement package uploaded for proof",
    "Milestone 2: Referral split reviewed by parties",
    "Milestone 3: Service milestone submitted for approval",
    "Milestone 4: Proof certificate prepared for review",
  ]);

  drawSection(ctx, "5. Proof record language", [
    "For this demo, the PDF agreement is hashed using SHA-256. DealVault stores the resulting hash, proof type, external reference, and timestamp so a viewer can later confirm that the demo file matches the recorded proof.",
    "The PDF contents stay off-chain. Only the document hash and non-sensitive proof metadata are used for the demo proof package.",
  ]);

  drawSection(ctx, "6. Blockchain proof disclaimer", [
    "Blockchain records can help show when a proof event was recorded and what hash was associated with that event. A blockchain proof record does not make an agreement legally valid by itself and does not confirm that all parties had authority, capacity, or required approvals.",
    "DealVault is positioned as proof and workflow support, not escrow, custody, legal representation, brokerage compliance, securities issuance, or guaranteed payout infrastructure.",
  ]);

  drawSection(ctx, "7. Non-legal disclaimer", [disclaimer]);

  ensureSpace(ctx, 170);
  ctx.y -= 12;
  ctx.page.drawText("8. Signature placeholders", {
    x: 72,
    y: ctx.y,
    size: 13,
    font: bold,
    color: rgb(0.02, 0.3, 0.42),
  });
  ctx.y -= 40;

  const signatureRows = [
    ["VestBlock Demo Client LLC", "Authorized Demo Representative"],
    ["Northstar Referral Partners LLC", "Authorized Demo Representative"],
    ["Apex Milestone Services LLC", "Authorized Demo Representative"],
  ];

  for (const [entity, role] of signatureRows) {
    ensureSpace(ctx, 70);
    ctx.page.drawLine({
      start: { x: 72, y: ctx.y },
      end: { x: 318, y: ctx.y },
      thickness: 0.8,
      color: rgb(0.2, 0.24, 0.3),
    });
    ctx.page.drawText(entity, {
      x: 72,
      y: ctx.y - 16,
      size: 9.5,
      font: bold,
      color: rgb(0.12, 0.16, 0.22),
    });
    ctx.page.drawText(role, {
      x: 72,
      y: ctx.y - 31,
      size: 8.5,
      font,
      color: rgb(0.35, 0.4, 0.48),
    });
    ctx.page.drawLine({
      start: { x: 350, y: ctx.y },
      end: { x: 510, y: ctx.y },
      thickness: 0.8,
      color: rgb(0.2, 0.24, 0.3),
    });
    ctx.page.drawText("Date", {
      x: 350,
      y: ctx.y - 16,
      size: 8.5,
      font,
      color: rgb(0.35, 0.4, 0.48),
    });
    ctx.y -= 66;
  }

  drawFooter(ctx);
  writeFileSync(pdfPath, await doc.save());
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

async function main() {
  await createDemoAgreementPdf();

  const pdf = readFileSync(pdfPath);
  const hash = createHash("sha256").update(pdf).digest("hex");
  const documentHash = `0x${hash}`;
  const timestamp = new Date().toISOString();
  const demoDealId = `dv-demo-${hash.slice(0, 12)}`;
  const polygonDeployment = readJson<DeploymentRecord>(polygonDeploymentPath);
  const liveProof = readJson<LiveProofRecord>(polygonLiveProofPath);
  const proofVaultAddress = polygonDeployment?.contracts?.proofVault ?? null;
  const latestLiveProofTx = liveProof?.transactionHash ?? null;

  const demoPackage = {
    generatedAt: timestamp,
    demoDealName: "DealVault Demo Agreement Record",
    demoDealId,
    parties,
    pdf: {
      filePath: "public/dealvault/demo-agreement.pdf",
      publicPath: "/dealvault/demo-agreement.pdf",
      sha256: hash,
    },
    proof: {
      documentHash,
      algorithm: "SHA-256",
      proofType: "demo_agreement_pdf_hash",
      externalReference: "dealvault-demo-agreement-2026",
      timestamp,
      sendsRawDocumentOnChain: false,
      onChainPayloadDescription:
        "Only hash, proof type, external reference, and timestamp-style metadata are used for proof workflows.",
    },
    payoutSplits: [
      {
        party: "VestBlock Demo Client LLC",
        allocationPercent: 70,
        status: "sample_owner_allocation",
      },
      {
        party: "Northstar Referral Partners LLC",
        allocationPercent: 20,
        status: "sample_referral_allocation",
      },
      {
        party: "Apex Milestone Services LLC",
        allocationPercent: 10,
        status: "sample_milestone_services_allocation",
      },
    ],
    milestones: [
      {
        title: "Agreement package uploaded for proof",
        status: "completed",
      },
      {
        title: "Referral split reviewed by parties",
        status: "in_review",
      },
      {
        title: "Service milestone submitted for approval",
        status: "submitted",
      },
      {
        title: "Proof certificate prepared for review",
        status: "ready",
      },
    ],
    certificate: {
      imagePath: "/dealvault/sample-certificate.png",
      pdfPath: "/dealvault/sample-certificate.pdf",
    },
    polygon: {
      network: "Polygon",
      chainId: 137,
      proofVaultAddress,
      proofVaultExplorerUrl: proofVaultAddress
        ? `https://polygonscan.com/address/${proofVaultAddress}`
        : null,
      latestLiveProofTransactionHash: latestLiveProofTx,
      latestLiveProofExplorerUrl: latestLiveProofTx
        ? `https://polygonscan.com/tx/${latestLiveProofTx}`
        : null,
      liveTransactionUsedForThisPackage: false,
    },
    disclaimer,
  };

  mkdirSync(dirname(packagePath), { recursive: true });
  writeFileSync(packagePath, `${JSON.stringify(demoPackage, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        pdfPath,
        packagePath,
        documentHash,
        proofType: demoPackage.proof.proofType,
        externalReference: demoPackage.proof.externalReference,
        demoDealId,
        timestamp,
        liveTransactionUsed: false,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
