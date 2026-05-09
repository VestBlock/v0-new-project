import { readFileSync } from "node:fs";
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
  const documentHash = ethers.keccak256(
    ethers.toUtf8Bytes(`dealvault-proof-estimate-${Date.now()}`)
  );
  const feeData = await ethers.provider.getFeeData();
  const gas = await proofVault.createProof.estimateGas(
    documentHash,
    "proof_estimate",
    `estimate-${Date.now()}`
  );
  const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? BigInt(0);
  const estimatedCostWei = gas * gasPrice;

  console.log(
    JSON.stringify(
      {
        network: network.name,
        chainId: Number(network.config.chainId || 0),
        signer: signer.address,
        contract: proofVaultAddress,
        method: "ProofVault.createProof",
        gasUnits: gas.toString(),
        gasPriceWei: gasPrice.toString(),
        estimatedCostNative: ethers.formatEther(estimatedCostWei),
        sendsTransaction: false,
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
