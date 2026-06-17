import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const root = process.cwd();
const dataPath = path.join(root, "data/property-portfolios/milwaukee-10-unit-duplex-portfolio.json");
const workflowPath = path.join(root, "data/property-portfolios/milwaukee-10-unit-duplex-portfolio.workflow.json");
const outPath = path.join(root, "reports/VestBlock_Milwaukee_10_Unit_Portfolio_Redacted_Teaser.pdf");
const photoDir = path.join(root, "reports/neville-milwaukee-portfolio/photos");

const portfolio = JSON.parse(await fs.readFile(dataPath, "utf8"));
const workflow = JSON.parse(await fs.readFile(workflowPath, "utf8"));

const privateTokens = [
  "2119",
  "2121",
  "2421",
  "2423",
  "2954",
  "3533",
  "3425",
  "3427",
  "34th",
  "35th",
  "24th",
  "1st",
  "11th",
  "Neville",
  "Alperstein",
  "Raha",
  "Cunningham",
  "Palatine",
  "APN",
  "Parcel ID",
  "Zillow",
  "Realtor",
  "Apartments.com",
];

const dealMachineFacts = {
  "3425-3427-n-11th-st": {
    publicValue: 144000,
    equityIndicator: "67% estimated equity",
    bedsBaths: "8 beds / 2 baths",
    squareFeet: 2618,
    yearBuilt: "1923",
    lot: "0.09 acres",
    taxStatus: "2024 taxes shown current",
    annualTax: 1621,
    repairEstimate: 91630,
    photo: "duplex-a-redacted.png",
    note: "Vacancy indicator present in DealMachine; verify occupancy before marketing as stabilized.",
  },
  "2119-2121-n-34th-st": {
    publicValue: 73000,
    equityIndicator: "100% estimated equity",
    bedsBaths: "6 beds / 2 baths",
    squareFeet: 2613,
    yearBuilt: "Not shown in DealMachine panel",
    lot: "Not shown",
    taxStatus: "Tax detail not shown in captured panel",
    annualTax: null,
    repairEstimate: 91455,
    photo: "duplex-b-redacted.png",
    note: "DealMachine panel showed a free-and-clear/high-equity signal; verify title before relying on it.",
  },
  "2954-n-24th-pl": {
    publicValue: 101000,
    equityIndicator: "100% estimated equity",
    bedsBaths: "4 beds / 2 baths",
    squareFeet: 1721,
    yearBuilt: "1913",
    lot: "0.08 acres",
    taxStatus: "2024 taxes shown current",
    annualTax: 891,
    repairEstimate: 60235,
    photo: null,
    note: "Need fresh exterior/interior photos before sending full diligence packet.",
  },
  "3533-n-1st-st": {
    publicValue: 79000,
    equityIndicator: "100% estimated equity",
    bedsBaths: "4 beds / 2 baths",
    squareFeet: 1812,
    yearBuilt: "1910",
    lot: "0.05 acres",
    taxStatus: "2024 taxes shown current",
    annualTax: 1239,
    repairEstimate: 63420,
    photo: "duplex-d-redacted.png",
    note: "Public value and seller rent require comp validation before quoting investor upside.",
  },
  "2421-2423-n-35th-st": {
    publicValue: 130000,
    equityIndicator: "100% estimated equity",
    bedsBaths: "4 beds / 2 baths",
    squareFeet: 2264,
    yearBuilt: "1921",
    lot: "0.11 acres",
    taxStatus: "2024 taxes shown current",
    annualTax: 1719,
    repairEstimate: 79240,
    photo: null,
    note: "Photo still needed; verify rent, condition, and unit mix before releasing full address.",
  },
};

const aliases = {
  "3425-3427-n-11th-st": "Duplex A",
  "2119-2121-n-34th-st": "Duplex B",
  "2954-n-24th-pl": "Duplex C",
  "3533-n-1st-st": "Duplex D",
  "2421-2423-n-35th-st": "Duplex E",
};

const dollars = (value) =>
  value === null || value === undefined ? "TBD" : `$${Math.round(value).toLocaleString("en-US")}`;
const number = (value) => (value === null || value === undefined ? "TBD" : value.toLocaleString("en-US"));
const percent = (value) => `${Number(value).toFixed(2)}%`;

const pdfDoc = await PDFDocument.create();
const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
const dark = rgb(0.04, 0.08, 0.11);
const navy = rgb(0.07, 0.13, 0.17);
const ink = rgb(0.12, 0.16, 0.18);
const muted = rgb(0.39, 0.45, 0.49);
const line = rgb(0.82, 0.86, 0.88);
const teal = rgb(0.0, 0.55, 0.56);
const pale = rgb(0.94, 0.98, 0.97);
const white = rgb(1, 1, 1);

function addPage() {
  const page = pdfDoc.addPage([612, 792]);
  page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(0.985, 0.985, 0.975) });
  return page;
}

function drawText(page, text, x, y, opts = {}) {
  const font = opts.font ?? helvetica;
  const size = opts.size ?? 10;
  page.drawText(String(text), {
    x,
    y,
    size,
    font,
    color: opts.color ?? ink,
  });
}

function wrapText(text, maxWidth, size, font = helvetica) {
  const words = String(text).replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let lineText = "";
  for (const word of words) {
    const next = lineText ? `${lineText} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      lineText = next;
    } else {
      if (lineText) lines.push(lineText);
      lineText = word;
    }
  }
  if (lineText) lines.push(lineText);
  return lines;
}

function drawWrapped(page, text, x, y, maxWidth, opts = {}) {
  const size = opts.size ?? 10;
  const font = opts.font ?? helvetica;
  const leading = opts.leading ?? size + 4;
  const lines = wrapText(text, maxWidth, size, font);
  lines.forEach((lineText, index) => drawText(page, lineText, x, y - index * leading, { ...opts, font, size }));
  return y - Math.max(lines.length, 1) * leading;
}

function title(page, text, y) {
  drawText(page, text.toUpperCase(), 44, y, { font: bold, size: 10, color: teal });
  page.drawLine({ start: { x: 44, y: y - 8 }, end: { x: 568, y: y - 8 }, thickness: 1, color: line });
}

function metric(page, label, value, x, y, w = 120) {
  page.drawRectangle({ x, y, width: w, height: 58, color: white, borderColor: line, borderWidth: 1 });
  drawText(page, label.toUpperCase(), x + 10, y + 37, { font: bold, size: 7.5, color: muted });
  drawText(page, value, x + 10, y + 15, { font: bold, size: 14, color: dark });
}

function table(page, rows, x, y, widths, opts = {}) {
  const rowH = opts.rowH ?? 24;
  const headColor = opts.headColor ?? navy;
  rows.forEach((row, r) => {
    let cx = x;
    page.drawRectangle({
      x,
      y: y - r * rowH,
      width: widths.reduce((a, b) => a + b, 0),
      height: rowH,
      color: r === 0 ? headColor : r % 2 ? white : rgb(0.965, 0.975, 0.975),
      borderColor: line,
      borderWidth: 0.5,
    });
    row.forEach((cell, c) => {
      drawText(page, cell, cx + 7, y - r * rowH + 8, {
        size: r === 0 ? 8 : 8.5,
        font: r === 0 ? bold : helvetica,
        color: r === 0 ? white : ink,
      });
      cx += widths[c];
    });
  });
  return y - rows.length * rowH;
}

async function drawPhoto(page, fileName, x, y, w, h) {
  if (!fileName) {
    page.drawRectangle({ x, y, width: w, height: h, color: rgb(0.9, 0.92, 0.92), borderColor: line, borderWidth: 1 });
    drawText(page, "Photo pending", x + 18, y + h / 2 + 4, { font: bold, size: 12, color: muted });
    drawText(page, "Use full packet after NDA/POF", x + 18, y + h / 2 - 13, { size: 8.5, color: muted });
    return;
  }

  const imgBytes = await fs.readFile(path.join(photoDir, fileName));
  const image = await pdfDoc.embedPng(imgBytes);
  page.drawImage(image, { x, y, width: w, height: h });
  page.drawRectangle({ x, y, width: w, height: 20, color: rgb(0.02, 0.05, 0.06), opacity: 0.86 });
  drawText(page, "Public teaser image - exact address withheld", x + 8, y + 6, {
    font: bold,
    size: 7.5,
    color: white,
  });
}

function sanitizeOutputGuard(bytes) {
  const lower = bytes.toString("latin1").toLowerCase();
  const matches = privateTokens.filter((token) => lower.includes(token.toLowerCase()));
  if (matches.length) {
    throw new Error(`Private token leaked into PDF binary/text: ${matches.join(", ")}`);
  }
}

let page = addPage();
page.drawRectangle({ x: 0, y: 628, width: 612, height: 164, color: dark });
drawText(page, "VESTBLOCK", 44, 736, { font: bold, size: 11, color: rgb(0.54, 0.9, 0.88) });
drawWrapped(
  page,
  "Redacted Milwaukee 10-Unit Duplex Portfolio Teaser",
  44,
  704,
  430,
  { font: bold, size: 28, leading: 32, color: white },
);
drawWrapped(
  page,
  "Public marketing version. Exact addresses, seller identity, owner/contact data, parcel identifiers, and source links are withheld to protect the deal.",
  44,
  640,
  500,
  { size: 10.5, leading: 15, color: rgb(0.86, 0.93, 0.92) },
);

metric(page, "Total Units", `${portfolio.totalUnits}`, 44, 540);
metric(page, "Monthly Rent", dollars(portfolio.monthlyGrossRent), 176, 540);
metric(page, "Annual Rent", dollars(portfolio.annualGrossRent), 308, 540);
metric(page, "Ask / Unit", dollars(workflow.summary.pricePerUnitAtAsk), 440, 540);

title(page, "Executive Summary", 488);
drawWrapped(
  page,
  "Seller indicates a five-duplex, ten-unit Milwaukee portfolio with recent capital improvements across roofs, windows, furnaces, hot water heaters, electrical, and plumbing. Rent and improvement claims are seller-provided and must be verified through leases, estoppels, inspection, municipal records, and utility/tax documentation.",
  44,
  462,
  512,
  { size: 10.5, leading: 15 },
);
drawWrapped(
  page,
  `Asking price is ${dollars(portfolio.sellerAskingPrice)}, equal to ${dollars(workflow.summary.pricePerUnitAtAsk)} per unit and a ${workflow.summary.grossRentMultiplierAtAsk} GRM on seller-provided rent.`,
  44,
  386,
  512,
  { size: 10.5, leading: 15 },
);

title(page, "Portfolio Scorecard", 330);
table(
  page,
  [
    ["Metric", "Value", "Notes"],
    ["Gross scheduled income", dollars(portfolio.annualGrossRent), "Seller provided"],
    ["Effective gross income, 5% vacancy", dollars(workflow.vacancySensitivity["5%"].effectiveGrossIncome), "Model sensitivity"],
    ["Effective gross income, 8% vacancy", dollars(workflow.vacancySensitivity["8%"].effectiveGrossIncome), "Model sensitivity"],
    ["Price per unit", dollars(workflow.summary.pricePerUnitAtAsk), "At current ask"],
    ["Gross rent multiplier", `${workflow.summary.grossRentMultiplierAtAsk}x`, "At current ask"],
  ],
  44,
  286,
  [180, 130, 214],
);

drawWrapped(
  page,
  "Buyer release gate: provide exact addresses, rent roll, leases, interior photos, municipal checks, and seller access only after buyer is qualified and understands VestBlock is the deal source.",
  44,
  108,
  512,
  { size: 9.5, leading: 14, color: muted },
);

page = addPage();
drawText(page, "Financial Snapshot", 44, 744, { font: bold, size: 22, color: dark });
drawWrapped(page, "All expenses are modeled assumptions where actual operating statements are unavailable.", 44, 722, 500, {
  size: 10,
  color: muted,
});

title(page, "NOI and Cap Rate", 676);
table(
  page,
  [
    ["Scenario", "Expense Ratio", "NOI", "Cap @ Ask", "Cap @ $530k", "Cap @ $525k"],
    ...["conservative", "moderate", "aggressive"].map((key) => {
      const s = workflow.scenarioAnalysis[key];
      return [
        key[0].toUpperCase() + key.slice(1),
        percent(s.expenseRatioPct),
        dollars(s.noi),
        percent(s.capRateAtAskPct),
        percent(workflow.priceSensitivity["$530,000"].capRates[key].capRatePct),
        percent(workflow.priceSensitivity["$525,000"].capRates[key].capRatePct),
      ];
    }),
  ],
  44,
  632,
  [92, 92, 82, 82, 86, 90],
);

title(page, "DSCR and Cash Flow", 500);
table(
  page,
  [
    ["Price", "Loan", "Annual Debt", "Cons. DSCR / CF", "Mod. DSCR / CF", "Agg. DSCR / CF"],
    ...["$550,000", "$530,000", "$525,000"].map((price) => {
      const d = workflow.priceSensitivity[price].dscr.A;
      return [
        price,
        "75% / 7.0%",
        dollars(d.annualDebtService),
        `${d.byExpenseScenario.conservative.dscr} / ${dollars(d.byExpenseScenario.conservative.cashFlowAfterDebt)}`,
        `${d.byExpenseScenario.moderate.dscr} / ${dollars(d.byExpenseScenario.moderate.cashFlowAfterDebt)}`,
        `${d.byExpenseScenario.aggressive.dscr} / ${dollars(d.byExpenseScenario.aggressive.cashFlowAfterDebt)}`,
      ];
    }),
  ],
  44,
  456,
  [70, 76, 92, 116, 116, 116],
);
drawWrapped(
  page,
  "The $525k-$530k range improves DSCR and annual cash flow, but final viability still depends on verified rent roll, unit condition, taxes, insurance, utilities, and lender underwriting.",
  44,
  328,
  512,
  { size: 10.5, leading: 15 },
);

title(page, "Modeled Expense Assumptions", 270);
table(
  page,
  [
    ["Scenario", "Vacancy", "Taxes", "Insurance", "Repairs", "Capex", "Mgmt"],
    ...["conservative", "moderate", "aggressive"].map((key) => {
      const a = portfolio.expenseAssumptions[key];
      return [
        key[0].toUpperCase() + key.slice(1),
        percent(a.vacancyPct * 100),
        dollars(a.propertyTaxesAnnual),
        dollars(a.insuranceAnnual),
        percent(a.repairsPctOfGsi * 100),
        percent(a.capexPctOfGsi * 100),
        percent(a.managementPctOfEgi * 100),
      ];
    }),
  ],
  44,
  226,
  [86, 72, 72, 84, 70, 70, 70],
);

const cards = workflow.propertyScorecards
  .map((card) => ({
    ...card,
    alias: aliases[card.id],
    facts: dealMachineFacts[card.id],
  }))
  .sort((a, b) => a.alias.localeCompare(b.alias));

page = addPage();
drawText(page, "Property Scorecards", 44, 744, { font: bold, size: 22, color: dark });
drawWrapped(page, "Public teaser labels are intentionally redacted. Exact addresses are withheld until buyer qualification.", 44, 722, 500, {
  size: 10,
  color: muted,
});

for (const [index, card] of cards.entries()) {
  if (index === 4) {
    page = addPage();
    drawText(page, "Property Scorecards Continued", 44, 744, { font: bold, size: 22, color: dark });
  }
  const col = index % 2;
  const row = Math.floor((index % 4) / 2);
  const x = col === 0 ? 44 : 316;
  const y = index === 4 ? 516 : 516 - row * 284;
  page.drawRectangle({ x, y, width: 244, height: 240, color: white, borderColor: line, borderWidth: 1 });
  await drawPhoto(page, card.facts?.photo, x, y + 128, 244, 72);
  drawText(page, card.alias, x + 12, y + 108, { font: bold, size: 15, color: dark });
  drawText(page, "Milwaukee, WI - exact location withheld", x + 12, y + 92, { size: 8.5, color: muted });
  drawText(page, `Rent: ${dollars(card.monthlyRent)}/mo | ${dollars(card.rentPerUnit)}/unit`, x + 12, y + 72, {
    font: bold,
    size: 9.5,
    color: teal,
  });
  drawText(page, `Income share: ${percent(card.incomeContributionPct)} | Alloc. value: ${dollars(card.allocatedValueAtAsk)}`, x + 12, y + 56, {
    size: 8.3,
    color: ink,
  });
  drawText(page, `Public value: ${dollars(card.facts?.publicValue)} | ${card.facts?.equityIndicator ?? "Equity TBD"}`, x + 12, y + 42, {
    size: 8.3,
    color: ink,
  });
  drawText(page, `${card.facts?.bedsBaths ?? card.bedBathSummary} | ${number(card.facts?.squareFeet ?? card.squareFeet)} sf`, x + 12, y + 28, {
    size: 8.3,
    color: ink,
  });
  drawText(page, `Year: ${card.facts?.yearBuilt ?? "TBD"} | Tax: ${card.facts?.annualTax ? dollars(card.facts.annualTax) : "TBD"} | Repairs est: ${dollars(card.facts?.repairEstimate)}`, x + 12, y + 14, {
    size: 7.6,
    color: muted,
  });
  drawWrapped(page, card.facts?.note ?? "Verify rent, occupancy, and condition before buyer release.", x + 12, y - 8, 218, {
    size: 7.5,
    leading: 10,
    color: muted,
  });
}

page = addPage();
drawText(page, "Risk, Diligence, and Buyer Fit", 44, 744, { font: bold, size: 22, color: dark });
title(page, "Missing Data Before Acquisition", 690);
const missing = portfolio.missingData.slice(0, 10);
let cursorY = 664;
for (const item of missing) {
  drawText(page, "-", 50, cursorY, { size: 9, color: teal });
  cursorY = drawWrapped(page, item, 64, cursorY, 492, { size: 9, leading: 12 }) - 1;
}

title(page, "Buyer Profiles", 474);
table(
  page,
  [
    ["Buyer Type", "Why It May Fit"],
    ["DSCR investor", "Existing gross rent and 10-unit scale may support lender analysis if NOI verifies."],
    ["Small multifamily investor", "Five duplexes can be marketed as a starter portfolio or neighborhood density play."],
    ["Portfolio buyer", "Multiple assets create operational leverage if condition and occupancy are clean."],
    ["1031 buyer", "May value speed and replacement-property identification more than a single-asset buyer."],
    ["Cash-flow buyer", "Needs verified rent roll, utility split, and post-rehab maintenance assumptions."],
  ],
  44,
  430,
  [150, 374],
  { rowH: 28 },
);

title(page, "Release Checklist", 236);
drawWrapped(
  page,
  "Before sending the full unredacted packet: qualify buyer, collect proof of funds or lender letter, confirm non-circumvention expectations, then release exact addresses, rent roll, leases, interior photos, municipal records, seller disclosures, and inspection access.",
  44,
  210,
  512,
  { size: 10.5, leading: 15 },
);
page.drawRectangle({ x: 44, y: 72, width: 524, height: 68, color: pale, borderColor: rgb(0.65, 0.83, 0.8), borderWidth: 1 });
drawWrapped(
  page,
  "Important: This teaser presents calculations, assumptions, risks, and available public/seller-provided data only. It is not investment advice and should not be treated as final diligence.",
  60,
  116,
  492,
  { font: bold, size: 10, leading: 14, color: navy },
);

const pdfBytes = await pdfDoc.save();
sanitizeOutputGuard(Buffer.from(pdfBytes));
await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(outPath, pdfBytes);
console.log(outPath);
