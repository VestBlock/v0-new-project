import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";

if (existsSync(".env.local")) {
  loadEnvFile(".env.local");
}
if (existsSync(".env")) {
  loadEnvFile(".env");
}

const PRIVATE_KEY =
  process.env.DEALVAULT_BLOCKCHAIN_ADMIN_PRIVATE_KEY ||
  process.env.BLOCKCHAIN_ADMIN_PRIVATE_KEY ||
  "";
const RPC_URL =
  process.env.DEALVAULT_BLOCKCHAIN_RPC_URL ||
  process.env.BLOCKCHAIN_RPC_URL ||
  "";
const EXPLORER_API_KEY =
  process.env.DEALVAULT_BLOCKCHAIN_EXPLORER_API_KEY ||
  process.env.BLOCKCHAIN_EXPLORER_API_KEY ||
  "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    amoy: {
      url: RPC_URL || "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    polygon: {
      url: RPC_URL || "https://polygon-rpc.com",
      chainId: 137,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    baseSepolia: {
      url: RPC_URL || "https://sepolia.base.org",
      chainId: 84532,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    base: {
      url: RPC_URL || "https://mainnet.base.org",
      chainId: 8453,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      polygon: EXPLORER_API_KEY,
      polygonAmoy: EXPLORER_API_KEY,
      base: EXPLORER_API_KEY,
      baseSepolia: EXPLORER_API_KEY,
    },
    customChains: [
      {
        network: "polygon",
        chainId: 137,
        urls: {
          apiURL: "https://api.polygonscan.com/api",
          browserURL: "https://polygonscan.com",
        },
      },
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 60000,
  },
};

export default config;
