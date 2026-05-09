import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const contracts = [
  "DealVaultRealEstate",
  "ProofVault",
  "PartnerPay",
  "MilestoneVault",
];

for (const contractName of contracts) {
  const artifactPath = resolve(
    process.cwd(),
    "artifacts",
    "contracts",
    `${contractName}.sol`,
    `${contractName}.json`
  );
  const outputPath = resolve(process.cwd(), "lib", "blockchain", "abis", `${contractName}.json`);
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { abi: unknown };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(artifact.abi, null, 2));
}
