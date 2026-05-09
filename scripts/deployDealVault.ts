import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import hre from "hardhat";

const MAINNET_NETWORKS = new Set(["polygon", "base"]);

async function main() {
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();
  const adminAddress = process.env.DEALVAULT_ADMIN_ADDRESS || deployer.address;
  const isMainnet = MAINNET_NETWORKS.has(network.name);

  if (isMainnet && process.env.ALLOW_MAINNET_DEPLOYMENT !== "true") {
    throw new Error(
      `Refusing to deploy to ${network.name} without ALLOW_MAINNET_DEPLOYMENT=true.`
    );
  }

  console.log(`Deploying DealVault contracts to ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Admin:    ${adminAddress}`);

  const provider = deployer.provider;
  if (!provider) {
    throw new Error("Deployer provider is unavailable.");
  }

  let nextNonce = await provider.getTransactionCount(deployer.address, "pending");
  console.log(`Starting nonce: ${nextNonce}`);

  const DealVaultRealEstate = await ethers.getContractFactory("DealVaultRealEstate");
  const dealVaultRealEstate = await DealVaultRealEstate.deploy(adminAddress, {
    nonce: nextNonce++,
  });
  await dealVaultRealEstate.waitForDeployment();

  const ProofVault = await ethers.getContractFactory("ProofVault");
  const proofVault = await ProofVault.deploy(adminAddress, {
    nonce: nextNonce++,
  });
  await proofVault.waitForDeployment();

  const PartnerPay = await ethers.getContractFactory("PartnerPay");
  const partnerPay = await PartnerPay.deploy(adminAddress, {
    nonce: nextNonce++,
  });
  await partnerPay.waitForDeployment();

  const MilestoneVault = await ethers.getContractFactory("MilestoneVault");
  const milestoneVault = await MilestoneVault.deploy(adminAddress, {
    nonce: nextNonce++,
  });
  await milestoneVault.waitForDeployment();

  const deployment = {
    network: network.name,
    chainId: Number(network.config.chainId || 0),
    deployer: deployer.address,
    adminAddress,
    deployedAt: new Date().toISOString(),
    contracts: {
      dealVaultRealEstate: await dealVaultRealEstate.getAddress(),
      proofVault: await proofVault.getAddress(),
      partnerPay: await partnerPay.getAddress(),
      milestoneVault: await milestoneVault.getAddress(),
    },
  };

  mkdirSync(resolve(process.cwd(), "deployments"), { recursive: true });
  const outputPath = resolve(process.cwd(), `deployments/${network.name}.json`);
  writeFileSync(outputPath, `${JSON.stringify(deployment, null, 2)}\n`, "utf8");

  console.log(`Wrote deployment file to ${outputPath}`);
  console.log(JSON.stringify(deployment, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
