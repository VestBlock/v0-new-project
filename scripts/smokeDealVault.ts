import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import hre from "hardhat";

interface DeploymentRecord {
  network: string;
  chainId: number;
  deployer: string;
  adminAddress: string;
  deployedAt: string;
  contracts: {
    dealVaultRealEstate: string;
    proofVault: string;
    partnerPay: string;
    milestoneVault: string;
  };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSuccessfulWrite<T>(run: () => Promise<T>, label: string) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (attempt === 3) {
        break;
      }

      console.warn(`${label} attempt ${attempt} failed, retrying after RPC settle delay.`);
      await sleep(3000);
    }
  }

  throw lastError;
}

function parseEvent(contract: any, receipt: any, eventName: string) {
  for (const log of receipt.logs || []) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === eventName) {
        return parsed.args;
      }
    } catch {
      // ignore unrelated logs
    }
  }

  throw new Error(`Event ${eventName} not found in receipt.`);
}

async function main() {
  const { ethers, network } = hre;
  const deploymentPath = resolve(process.cwd(), `deployments/${network.name}.json`);
  const deployment = JSON.parse(readFileSync(deploymentPath, "utf8")) as DeploymentRecord;

  const [signer] = await ethers.getSigners();
  const provider = signer.provider;
  if (!provider) {
    throw new Error("Signer provider is unavailable.");
  }

  const dealVault = await ethers.getContractAt(
    "DealVaultRealEstate",
    deployment.contracts.dealVaultRealEstate,
    signer
  );
  const proofVault = await ethers.getContractAt(
    "ProofVault",
    deployment.contracts.proofVault,
    signer
  );
  const partnerPay = await ethers.getContractAt(
    "PartnerPay",
    deployment.contracts.partnerPay,
    signer
  );
  const milestoneVault = await ethers.getContractAt(
    "MilestoneVault",
    deployment.contracts.milestoneVault,
    signer
  );

  const stamp = Date.now().toString();
  const propertyHash = ethers.keccak256(ethers.toUtf8Bytes(`dealvault-property-${stamp}`));
  const documentHash = ethers.keccak256(ethers.toUtf8Bytes(`dealvault-proof-${stamp}`));

  console.log(`Running DealVault smoke test on ${network.name}`);
  console.log(`Signer: ${signer.address}`);
  let nextNonce = await provider.getTransactionCount(signer.address, "pending");
  console.log(`Starting nonce: ${nextNonce}`);

  const proofTx = await proofVault.createProof(documentHash, "smoke_test_proof", `proof-${stamp}`, {
    nonce: nextNonce++,
  });
  const proofReceipt = await proofTx.wait();
  const proofArgs = parseEvent(proofVault, proofReceipt, "ProofCreated");
  const proofId = proofArgs.proofId as string;

  const dealTx = await dealVault.createDeal(propertyHash, 0, `deal-${stamp}`, {
    nonce: nextNonce++,
  });
  const dealReceipt = await dealTx.wait();
  const dealArgs = parseEvent(dealVault, dealReceipt, "DealCreated");
  const dealId = dealArgs.dealId as string;

  await (await dealVault.updateDealStatus(dealId, 1, { nonce: nextNonce++ })).wait();
  await (await dealVault.attachProof(dealId, proofId, { nonce: nextNonce++ })).wait();

  const partnerDealTx = await partnerPay.createDeal(`partner-${stamp}`, BigInt(250000), {
    nonce: nextNonce++,
  });
  const partnerDealReceipt = await partnerDealTx.wait();
  const partnerArgs = parseEvent(partnerPay, partnerDealReceipt, "DealCreated");
  const partnerDealId = partnerArgs.dealId as string;
  await (
    await partnerPay.addSplit(partnerDealId, signer.address, "Smoke Split", 5000, {
      nonce: nextNonce++,
    })
  ).wait();
  await (await partnerPay.lockDeal(partnerDealId, { nonce: nextNonce++ })).wait();
  await (await partnerPay.markSplitPaid(partnerDealId, 0, { nonce: nextNonce++ })).wait();

  const projectTx = await milestoneVault.createProject(
    `project-${stamp}`,
    "contractor_rehab",
    BigInt(500000),
    { nonce: nextNonce++ }
  );
  const projectReceipt = await projectTx.wait();
  const projectArgs = parseEvent(milestoneVault, projectReceipt, "ProjectCreated");
  const projectId = projectArgs.projectId as string;
  await (
    await milestoneVault.addMilestone(
      projectId,
      "Smoke milestone",
      "Verify contract record updates",
      BigInt(100000),
      BigInt(Math.floor(Date.now() / 1000) + 86400),
      { nonce: nextNonce++ }
    )
  ).wait();
  await (
    await milestoneVault.submitMilestoneProof(projectId, 0, proofId, {
      nonce: nextNonce++,
    })
  ).wait();
  await (await milestoneVault.approveMilestone(projectId, 0, { nonce: nextNonce++ })).wait();
  const completeMilestoneNonce = nextNonce++;
  await waitForSuccessfulWrite(
    async () =>
      milestoneVault
        .completeMilestone(projectId, 0, { nonce: completeMilestoneNonce })
        .then((tx: any) => tx.wait()),
    "completeMilestone"
  );

  const smokeResult = {
    network: network.name,
    chainId: Number(network.config.chainId || 0),
    signer: signer.address,
    executedAt: new Date().toISOString(),
    dealVault: {
      dealId,
      propertyHash,
      proofId,
    },
    partnerPay: {
      dealId: partnerDealId,
    },
    milestoneVault: {
      projectId,
    },
  };

  mkdirSync(resolve(process.cwd(), "deployments"), { recursive: true });
  const outputPath = resolve(process.cwd(), `deployments/${network.name}.smoke.json`);
  writeFileSync(outputPath, `${JSON.stringify(smokeResult, null, 2)}\n`, "utf8");

  console.log(`Smoke test complete. Wrote ${outputPath}`);
  console.log(JSON.stringify(smokeResult, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
