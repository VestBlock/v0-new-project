import hre from "hardhat";

function parseFirstEvent(contract: any, receipt: any, eventName: string) {
  for (const log of receipt.logs || []) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === eventName) {
        return parsed.args;
      }
    } catch {
      // Ignore unrelated logs.
    }
  }

  throw new Error(`Event ${eventName} not found.`);
}

async function main() {
  const { ethers, network } = hre;
  const [signer] = await ethers.getSigners();
  const provider = signer.provider;
  if (!provider) {
    throw new Error("Signer provider is unavailable.");
  }

  const deployment = await import(`../deployments/${network.name}.json`, {
    with: { type: "json" },
  });

  const contract = await ethers.getContractAt(
    "MilestoneVault",
    deployment.default.contracts.milestoneVault,
    signer
  );

  let nextNonce = await provider.getTransactionCount(signer.address, "pending");
  const stamp = Date.now().toString();

  console.log(`Diagnosing MilestoneVault on ${network.name}`);
  console.log(`Signer: ${signer.address}`);
  console.log(`Starting nonce: ${nextNonce}`);

  const projectTx = await contract.createProject(`diag-${stamp}`, "contractor_rehab", BigInt(500000), {
    nonce: nextNonce++,
  });
  const projectReceipt = await projectTx.wait();
  const projectArgs = parseFirstEvent(contract, projectReceipt, "ProjectCreated");
  const projectId = projectArgs.projectId as string;
  console.log(`Project: ${projectId}`);

  await (
    await contract.addMilestone(
      projectId,
      "Diagnostic milestone",
      "Check mainnet milestone completion",
      BigInt(100000),
      BigInt(Math.floor(Date.now() / 1000) + 86400),
      { nonce: nextNonce++ }
    )
  ).wait();

  const proofId = ethers.keccak256(ethers.toUtf8Bytes(`diag-proof-${stamp}`));
  await (await contract.submitMilestoneProof(projectId, 0, proofId, { nonce: nextNonce++ })).wait();
  let milestones = await contract.getMilestones(projectId);
  console.log(`Status after submit: ${milestones[0].status.toString()}`);

  await (await contract.approveMilestone(projectId, 0, { nonce: nextNonce++ })).wait();
  milestones = await contract.getMilestones(projectId);
  console.log(`Status after approve: ${milestones[0].status.toString()}`);

  try {
    await contract.completeMilestone.staticCall(projectId, 0);
    console.log("Static call for completeMilestone passed.");
  } catch (error) {
    console.error("Static call for completeMilestone failed:", error);
  }

  await (await contract.completeMilestone(projectId, 0, { nonce: nextNonce++ })).wait();
  milestones = await contract.getMilestones(projectId);
  console.log(`Status after complete: ${milestones[0].status.toString()}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
