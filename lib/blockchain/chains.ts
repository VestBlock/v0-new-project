import "server-only";
import type { Chain } from "viem";

export interface DealVaultChainConfig {
  id: number;
  slug: string;
  name: string;
  rpcUrl: string;
  explorerBaseUrl: string;
  viemChain: Chain;
}

const RPC_URL =
  process.env.DEALVAULT_BLOCKCHAIN_RPC_URL ||
  process.env.BLOCKCHAIN_RPC_URL ||
  "";

const polygonAmoy = {
  id: 80002,
  name: "Polygon Amoy",
  nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc-amoy.polygon.technology"] },
  },
  blockExplorers: {
    default: { name: "PolygonScan", url: "https://amoy.polygonscan.com" },
  },
  testnet: true,
} as const satisfies Chain;

const baseSepolia = {
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://sepolia.base.org"] },
  },
  blockExplorers: {
    default: { name: "BaseScan", url: "https://sepolia.basescan.org" },
  },
  testnet: true,
} as const satisfies Chain;

const polygon = {
  id: 137,
  name: "Polygon",
  nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://polygon-bor-rpc.publicnode.com"] },
  },
  blockExplorers: {
    default: { name: "PolygonScan", url: "https://polygonscan.com" },
  },
} as const satisfies Chain;

const base = {
  id: 8453,
  name: "Base",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.base.org"] },
  },
  blockExplorers: {
    default: { name: "BaseScan", url: "https://basescan.org" },
  },
} as const satisfies Chain;

const hardhat = {
  id: 31337,
  name: "Hardhat",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
  testnet: true,
} as const satisfies Chain;

export const DEALVAULT_CHAINS: Record<number, DealVaultChainConfig> = {
  80002: {
    id: 80002,
    slug: "polygon-amoy",
    name: "Polygon Amoy",
    rpcUrl: RPC_URL || "https://rpc-amoy.polygon.technology",
    explorerBaseUrl: "https://amoy.polygonscan.com",
    viemChain: polygonAmoy,
  },
  84532: {
    id: 84532,
    slug: "base-sepolia",
    name: "Base Sepolia",
    rpcUrl: RPC_URL || "https://sepolia.base.org",
    explorerBaseUrl: "https://sepolia.basescan.org",
    viemChain: baseSepolia,
  },
  137: {
    id: 137,
    slug: "polygon",
    name: "Polygon",
    rpcUrl: RPC_URL || "https://polygon-bor-rpc.publicnode.com",
    explorerBaseUrl: "https://polygonscan.com",
    viemChain: polygon,
  },
  8453: {
    id: 8453,
    slug: "base",
    name: "Base",
    rpcUrl: RPC_URL || "https://mainnet.base.org",
    explorerBaseUrl: "https://basescan.org",
    viemChain: base,
  },
  31337: {
    id: 31337,
    slug: "hardhat",
    name: "Hardhat",
    rpcUrl: RPC_URL || "http://127.0.0.1:8545",
    explorerBaseUrl: "",
    viemChain: hardhat,
  },
};

export function getDealVaultChainId() {
  return Number(process.env.DEALVAULT_CHAIN_ID || process.env.BLOCKCHAIN_CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || "80002");
}

export function getDealVaultChain() {
  const chain = DEALVAULT_CHAINS[getDealVaultChainId()];
  if (!chain) {
    throw new Error(`Unsupported DealVault chain id: ${getDealVaultChainId()}`);
  }

  return chain;
}

export function getDealVaultContractAddresses() {
  return {
    dealVaultRealEstate:
      (process.env.NEXT_PUBLIC_DEALVAULT_REAL_ESTATE_ADDRESS || "") as `0x${string}`,
    proofVault:
      (
        process.env.NEXT_PUBLIC_PROOF_VAULT_ADDRESS ||
        process.env.NEXT_PUBLIC_DEALVAULT_PROOF_VAULT_ADDRESS ||
        ""
      ) as `0x${string}`,
    partnerPay:
      (
        process.env.NEXT_PUBLIC_PARTNER_PAY_ADDRESS ||
        process.env.NEXT_PUBLIC_DEALVAULT_PARTNER_PAY_ADDRESS ||
        ""
      ) as `0x${string}`,
    milestoneVault:
      (
        process.env.NEXT_PUBLIC_MILESTONE_VAULT_ADDRESS ||
        process.env.NEXT_PUBLIC_DEALVAULT_MILESTONE_VAULT_ADDRESS ||
        ""
      ) as `0x${string}`,
  };
}

export function explorerTxUrl(txHash: string) {
  const chain = getDealVaultChain();
  if (!chain.explorerBaseUrl) return "";
  return `${chain.explorerBaseUrl}/tx/${txHash}`;
}
