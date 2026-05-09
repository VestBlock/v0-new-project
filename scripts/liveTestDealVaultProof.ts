import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import hre from "hardhat";

type DeploymentRecord = {
  contracts?: {
    proofVault?: string;
  };
};

async function main() {
  const { ethers, network } = hre;
  const deploymentPath = resolve(process.cwd(), `deployments/${network.name}.json`);
  const deployment = JSON.parse(readFileSync(deploymentPath, "utf8")) as DeploymentRecord;
  const proofVaultAddress = deployment.contracts?.proofVault;

  if (!proofVaultAddress) {
    throw new Error(`Missing ProofVault address in ${deploymentPath}.`);
  }

  const [signer] = await ethers.getSigners();
  const proofVault = await ethers.getContractAt("ProofVault", proofVaultAddress, signer);
  const stamp = Date.now().toString();
  const documentHash = ethers.keccak256(ethers.toUtf8Bytes(`vestblock-live-proof-${stamp}`));
  const proofType = "production_readiness_test";
  const externalRef = `live-proof-${stamp}`;

  const gas = await proofVault.createProof.estimateGas(documentHash, proofType, externalRef);
  const tx = await proofVault.createProof(documentHash, proofType, externalRef);
  const receipt = await tx.wait();

  const result = {
    network: network.name,
    chainId: Number(network.config.chainId || 0),
    signer: signer.address,
    contract: proofVaultAddress,
    method: "ProofVault.createProof",
    gasEstimate: gas.toString(),
    transactionHash: tx.hash,
    blockNumber: receipt?.blockNumber?.toString() || null,
    documentHash,
    proofType,
    externalRef,
    executedAt: new Date().toISOString(),
  };

  mkdirSync(resolve(process.cwd(), "deployments"), { recursive: true });
  const outputPath = resolve(process.cwd(), `deployments/${network.name}.live-proof.json`);
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({ ...result, outputPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
