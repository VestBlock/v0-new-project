import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";

const baseUrl = process.env.DEALVAULT_E2E_BASE_URL || "http://localhost:3000";
let email = process.env.DEALVAULT_E2E_EMAIL;
let password = process.env.DEALVAULT_E2E_PASSWORD;
const participantWallet = process.env.DEALVAULT_ADMIN_ADDRESS || "";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY before running this script.");
}

const outputDir = path.join(process.cwd(), "output", "playwright");
await fs.mkdir(outputDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const dealTitle = `DealVault UI Flow ${timestamp}`;
const proofTitle = `Proof ${timestamp}`;
const artifactPath = path.join(outputDir, "dealvault-ui-flow.json");
const screenshotPath = path.join(outputDir, "dealvault-ui-flow.png");
const failureScreenshotPath = path.join(outputDir, "dealvault-ui-flow.failure.png");
const failureHtmlPath = path.join(outputDir, "dealvault-ui-flow.failure.html");
const certificatePath = path.join(outputDir, "dealvault-certificate.pdf");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
let exitCode = 0;
let authCookieHeader = "";

function logStep(message) {
  console.log(`[dealvault-qa] ${message}`);
}

function toBase64Url(value) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function postAuthedJson(endpoint, body, label) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: authCookieHeader,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(240000),
  });

  if (response.ok) {
    return response;
  }

  throw new Error(`${label} failed with ${response.status}: ${await response.text()}`);
}

async function reloadDealPage() {
  await page.reload({
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
}

async function waitForDealRowByTitle(title, timeout = 120000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const { data, error } = await adminSupabase
      .from("real_estate_deals")
      .select("id")
      .eq("title", title)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load created deal: ${error.message}`);
    }

    if (data?.id) {
      return data.id;
    }

    await page.waitForTimeout(2000);
  }

  throw new Error(`Timed out waiting for deal row titled "${title}".`);
}

async function waitForProofRowByTitle(title, dealId, timeout = 120000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const { data, error } = await adminSupabase
      .from("real_estate_deal_proofs")
      .select("id,proof_id")
      .eq("title", title)
      .eq("real_estate_deal_id", dealId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load created proof: ${error.message}`);
    }

    if (data?.id && data.proof_id) {
      return data;
    }

    await page.waitForTimeout(2000);
  }

  throw new Error(`Timed out waiting for proof row titled "${title}".`);
}

async function seedAuthenticatedSession() {
  if (!email || !password) {
    const tempSuffix = timestamp.toLowerCase();
    email = `dealvault-e2e-${tempSuffix}@vestblock.local`;
    password = `VestBlock!${Date.now()}Qa`;

    const { data: createdUser, error: createUserError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createUserError || !createdUser.user) {
      throw new Error(createUserError?.message || "Unable to provision DealVault E2E user.");
    }

    const { error: profileError } = await adminSupabase
      .from("user_profiles")
      .upsert(
        {
          id: createdUser.user.id,
          user_id: createdUser.user.id,
          email: createdUser.user.email,
          role: "admin",
        },
        { onConflict: "id" }
      );

    if (profileError) {
      throw new Error(`Unable to provision DealVault E2E profile: ${profileError.message}`);
    }
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    throw new Error(error?.message || "Unable to sign in test user.");
  }

  const cookieName = `sb-${projectRef}-auth-token`;
  const cookieValue = `base64-${toBase64Url(JSON.stringify(data.session))}`;
  authCookieHeader = `${cookieName}=${cookieValue}`;

  await context.addCookies([
    {
      name: cookieName,
      value: cookieValue,
      url: baseUrl,
      sameSite: "Lax",
      expires: data.session.expires_at ?? undefined,
    },
  ]);
}

try {
  logStep("Seeding authenticated session.");
  await seedAuthenticatedSession();
  logStep("Opening new deal page.");
  await page.goto(`${baseUrl}/dashboard/dealvault/new`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await expect(page.url()).toContain("/dashboard/dealvault/new");
  await expect(page.getByRole("heading", { name: "Create a new DealVault record" }).first()).toBeVisible({ timeout: 30000 });
  const dealTypeSelect = page.getByLabel("Deal template").first();
  await dealTypeSelect.selectOption("contractor_rehab");
  await expect(page.getByRole("heading", { name: "Milestone drafts" }).first()).toBeVisible({ timeout: 30000 });
  await dealTypeSelect.selectOption("wholesale_assignment");
  await expect(page.getByRole("button", { name: "Add payout split" }).first()).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(10000);

  logStep("Creating deal.");
  const createDealResponse = await postAuthedJson(
    "/api/dealvault/create-deal",
    {
      dealType: "wholesale_assignment",
      title: dealTitle,
      externalRef: `ui-flow-${timestamp}`,
      propertyAddress: "123 Test Avenue",
      propertyCity: "Dallas",
      propertyState: "TX",
      propertyZip: "75001",
      contractPrice: 120000,
      buyerPrice: 135000,
      assignmentFee: 15000,
      sellerName: "Test Seller",
      buyerName: "Test Buyer",
      splits: [],
      milestones: [],
    },
    "Create deal request"
  );
  const createDealJson = await createDealResponse.json();
  const dealId = createDealJson?.deal?.id || (await waitForDealRowByTitle(dealTitle, 120000));
  if (!dealId) {
    throw new Error("Created deal row did not include a deal id.");
  }
  await page.goto(`${baseUrl}/dashboard/dealvault/${dealId}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await expect(page.getByRole("heading", { name: dealTitle })).toBeVisible({ timeout: 30000 });
  await expect(
    page.locator("div").filter({ hasText: /^Proof records$/ }).first()
  ).toBeVisible({ timeout: 30000 });

  logStep(`Deal created: ${dealId}`);
  logStep("Creating proof.");
  await postAuthedJson(
    "/api/dealvault/create-proof",
    {
      realEstateDealId: dealId,
      title: proofTitle,
      proofType: "purchase_agreement",
      documentHash: createHash("sha256").update(`Proof text for ${dealTitle}`).digest("hex"),
    },
    "Create proof request"
  );
  const createdProof = await waitForProofRowByTitle(proofTitle, dealId, 120000);
  const chainProofId = createdProof.proof_id;
  if (!chainProofId) {
    throw new Error("Created proof row did not include an on-chain proof id.");
  }
  await reloadDealPage();
  await expect(page.getByText(proofTitle).first()).toBeVisible({ timeout: 45000 });

  logStep("Advancing deal to active.");
  await postAuthedJson(
    "/api/dealvault/update-status",
    {
      realEstateDealId: dealId,
      newStatus: "active",
      note: "Activation verification update",
    },
    "Activate deal request"
  );
  await reloadDealPage();
  await expect(page.getByText(/wholesale_assignment · active/)).toBeVisible({
    timeout: 45000,
  });

  logStep("Advancing deal to under_contract.");
  await postAuthedJson(
    "/api/dealvault/update-status",
    {
      realEstateDealId: dealId,
      newStatus: "under_contract",
      note: "Lifecycle verification update",
    },
    "Under contract request"
  );
  await reloadDealPage();
  await expect(page.getByText(/wholesale_assignment · under_contract/)).toBeVisible({
    timeout: 45000,
  });

  logStep("Creating payout split.");
  const splitResponse = await postAuthedJson(
    "/api/dealvault/create-payout-split",
    {
      realEstateDealId: dealId,
      split: {
        participantName: "QA Partner",
        participantEmail: "qa.partner@example.com",
        participantRole: "JV Partner",
        participantWallet: participantWallet || undefined,
        bps: 5000,
      },
    },
    "Payout split request"
  );
  const splitJson = await splitResponse.json();
  const splitId = splitJson?.split?.id;
  if (!splitId) {
    throw new Error("Payout split response did not include a split id.");
  }
  await reloadDealPage();
  await expect(page.getByText(/QA Partner/).first()).toBeVisible({ timeout: 45000 });

  logStep(`Payout split created: ${splitId}`);
  logStep("Marking split paid.");
  await postAuthedJson(
    "/api/dealvault/mark-paid",
    {
      splitId,
      paid: true,
    },
    "Mark paid request"
  );
  await reloadDealPage();
  await expect(page.getByRole("button", { name: "Mark unpaid" }).first()).toBeVisible({
    timeout: 45000,
  });

  logStep("Locking payouts.");
  await postAuthedJson(
    "/api/dealvault/lock-payouts",
    {
      realEstateDealId: dealId,
    },
    "Lock payouts request"
  );
  await reloadDealPage();
  await expect(page.getByText(/wholesale_assignment · locked/)).toBeVisible({ timeout: 45000 });

  const milestoneTitle = `Milestone ${timestamp}`;
  logStep("Creating milestone project and milestone.");
  const milestoneCreateResponse = await postAuthedJson(
    "/api/dealvault/create-milestone",
    {
      realEstateDealId: dealId,
      projectTitle: `Project ${timestamp}`,
      projectType: "contractor_rehab",
      totalAmount: 25000,
      milestone: {
        title: milestoneTitle,
        description: "Initial rehab walkthrough and scope lock.",
        amount: 2500,
        dueDate: "2026-05-20",
      },
    },
    "Milestone create request"
  );
  const milestoneCreateJson = await milestoneCreateResponse.json();
  const milestoneId = milestoneCreateJson?.milestone?.id;
  if (!milestoneId) {
    throw new Error("Milestone create response did not include a milestone id.");
  }
  await reloadDealPage();
  await expect(page.getByText(milestoneTitle).first()).toBeVisible({ timeout: 45000 });

  let milestoneCard = page.locator("div.rounded-lg.border.p-3").filter({ hasText: milestoneTitle }).last();
  logStep(`Milestone created: ${milestoneId}`);
  logStep("Submitting milestone proof.");

  await postAuthedJson(
    "/api/dealvault/update-milestone",
    {
      milestoneId,
      status: "submitted",
      proofId: chainProofId,
    },
    "Milestone update request"
  );
  await reloadDealPage();
  milestoneCard = page.locator("div.rounded-lg.border.p-3").filter({ hasText: milestoneTitle }).last();
  await expect(milestoneCard.getByText("submitted").first()).toBeVisible({ timeout: 45000 });

  logStep("Generating certificate.");
  const proofCertificateCard = page
    .locator("div.rounded-lg.border.p-3")
    .filter({ hasText: proofTitle })
    .filter({ hasText: "Certificate PDF" })
    .first();
  await expect(proofCertificateCard).toBeVisible({ timeout: 30000 });
  const proofRowId = await proofCertificateCard
    .locator("button[data-proof-id]")
    .getAttribute("data-proof-id");
  if (!proofRowId) {
    throw new Error("Proof certificate button is missing a proof id.");
  }

  const certificateResponse = await fetch(`${baseUrl}/api/dealvault/generate-certificate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: authCookieHeader,
    },
    body: JSON.stringify({ proofId: proofRowId }),
    signal: AbortSignal.timeout(240000),
  });
  if (!certificateResponse.ok) {
    throw new Error(`Certificate request failed with ${certificateResponse.status}`);
  }

  await fs.writeFile(certificatePath, Buffer.from(await certificateResponse.arrayBuffer()));
  const certificateStats = await fs.stat(certificatePath);

  logStep("Opening admin page.");
  await page.goto(`${baseUrl}/admin/dealvault`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await expect(page.getByRole("heading", { name: "DealVault Admin" })).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("Recent blockchain transactions")).toBeVisible({ timeout: 60000 });

  await page.screenshot({ path: screenshotPath, fullPage: true });

  const result = {
    verifiedAt: new Date().toISOString(),
    baseUrl,
    email,
    dealId,
    dealTitle,
    proofTitle,
    milestoneTitle,
    certificatePath,
    certificateBytes: certificateStats.size,
    screenshotPath,
    finalUrl: page.url(),
  };

  await fs.writeFile(artifactPath, JSON.stringify(result, null, 2));
  logStep("DealVault verifier completed successfully.");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  exitCode = 1;
  await page.screenshot({ path: failureScreenshotPath, fullPage: true }).catch(() => {});
  try {
    await fs.writeFile(failureHtmlPath, await page.content());
  } catch {
    // The page may still be navigating while we capture failure artifacts.
  }
  console.error("[dealvault-qa] verifier failed:", error);
  throw error;
} finally {
  await context.close();
  await browser.close();
  process.exit(exitCode);
}
