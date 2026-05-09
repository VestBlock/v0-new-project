export type DealVaultPublicContract = {
  key: "dealVaultRealEstate" | "proofVault" | "partnerPay" | "milestoneVault";
  title: string;
  label: string;
  address: `0x${string}`;
  description: string;
  explorerUrl: string;
};

export const dealVaultPublicContracts: DealVaultPublicContract[] = [
  {
    key: "dealVaultRealEstate",
    title: "DealVaultRealEstate",
    label: "Agreement tracking",
    address: "0xc4c60151632b6Afb68F32add11852C27b643BC22",
    description:
      "Tracks real estate deal references, property hashes, status changes, and proof attachments as a clear public record.",
    explorerUrl:
      "https://polygonscan.com/address/0xc4c60151632b6Afb68F32add11852C27b643BC22",
  },
  {
    key: "proofVault",
    title: "ProofVault",
    label: "Proof records",
    address: "0xd675085FBf966Dc65501136B5ad5c0142DC27607",
    description:
      "Stores proof hashes and status changes so teams can show transparent event records without exposing raw agreements on-chain.",
    explorerUrl:
      "https://polygonscan.com/address/0xd675085FBf966Dc65501136B5ad5c0142DC27607",
  },
  {
    key: "partnerPay",
    title: "PartnerPay",
    label: "Payout ledger",
    address: "0x4EB94567a792094b1fB976B8D839EFD640659fc5",
    description:
      "Records referral, JV, and payout split status so teams have a clearer accountability trail.",
    explorerUrl:
      "https://polygonscan.com/address/0x4EB94567a792094b1fB976B8D839EFD640659fc5",
  },
  {
    key: "milestoneVault",
    title: "MilestoneVault",
    label: "Milestone audit trail",
    address: "0x138A25687ab95B401786303Bef88883CF685295E",
    description:
      "Tracks contractor and rehab milestone submissions, approvals, disputes, and completions as transparent event records.",
    explorerUrl:
      "https://polygonscan.com/address/0x138A25687ab95B401786303Bef88883CF685295E",
  },
];

export const dealVaultPublicDemo = {
  network: "Polygon",
  chainId: 137,
  liveSince: "2026-05-05T18:07:48.780Z",
  smokeVerifiedAt: "2026-05-05T18:20:54.650Z",
  sampleDealId:
    "0xec567d7cb0b9c64ebb88a5a92fcdf16477dec7b092f66be9993dfd95fd94fd0d",
  sampleProofId:
    "0x0c98047a85da10de920b7186123ea74e79f79c8f60e45a3ea0abd48e2c29e8ec",
  samplePartnerPayDealId:
    "0x9008575a96b963694f4ba344f09910ebc16164dc71e7ddfde1366c91d0ca3e7e",
  sampleProjectId:
    "0x4fee09243071a407baeb302159eff70f98056bb546ce79421283c9caa8db79ed",
  samplePropertyHash:
    "0xbd407bb44356f3bf726ee9de67f74fd5068e56f95f5fc6be1258891a161276fd",
  certificateImagePath: "/dealvault/sample-certificate.png",
  certificatePdfPath: "/dealvault/sample-certificate.pdf",
};

export function shortenHex(value: string, prefix = 8, suffix = 6) {
  if (value.length <= prefix + suffix + 3) return value;
  return `${value.slice(0, prefix)}...${value.slice(-suffix)}`;
}
