import hre from "hardhat";

const MAINNET_NETWORKS = new Set(["polygon", "base"]);

async function main() {
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();
  const adminAddress = process.env.DEALVAULT_ADMIN_ADDRESS || deployer.address;
  const balance = await ethers.provider.getBalance(deployer.address);
  const gasPrice = await ethers.provider.getFeeData();

  const readiness = {
    network: network.name,
    chainId: Number(network.config.chainId || 0),
    isMainnet: MAINNET_NETWORKS.has(network.name),
    deployer: deployer.address,
    adminAddress,
    sameAdminAsDeployer: adminAddress.toLowerCase() === deployer.address.toLowerCase(),
    balanceWei: balance.toString(),
    balanceNative: ethers.formatEther(balance),
    gasPriceWei: gasPrice.gasPrice?.toString() || null,
    maxFeePerGasWei: gasPrice.maxFeePerGas?.toString() || null,
    maxPriorityFeePerGasWei: gasPrice.maxPriorityFeePerGas?.toString() || null,
    allowMainnetDeployment: process.env.ALLOW_MAINNET_DEPLOYMENT === "true",
    rpcConfigured: Boolean(
      process.env.DEALVAULT_BLOCKCHAIN_RPC_URL || process.env.BLOCKCHAIN_RPC_URL
    ),
    privateKeyConfigured: Boolean(
      process.env.DEALVAULT_BLOCKCHAIN_ADMIN_PRIVATE_KEY ||
        process.env.BLOCKCHAIN_ADMIN_PRIVATE_KEY
    ),
  };

  console.log(JSON.stringify(readiness, null, 2));

  if (!readiness.rpcConfigured) {
    throw new Error("Missing blockchain RPC configuration.");
  }

  if (!readiness.privateKeyConfigured) {
    throw new Error("Missing blockchain private key configuration.");
  }

  if (balance === BigInt(0)) {
    throw new Error("Deployer wallet has zero balance.");
  }

  if (readiness.isMainnet && !readiness.allowMainnetDeployment) {
    throw new Error(
      `Mainnet readiness check passed, but ALLOW_MAINNET_DEPLOYMENT is not true for ${network.name}.`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
