import { expect } from "chai";
import hre from "hardhat";

describe("ProofVault", function () {
  it("creates proofs, verifies hashes, and updates status", async function () {
    const { ethers } = hre;
    const [admin, outsider] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("ProofVault");
    const contract = (await factory.deploy(admin.address)) as any;
    await contract.waitForDeployment();

    const documentHash = ethers.keccak256(ethers.toUtf8Bytes("agreement-pdf-hash"));
    let outsiderFailed = false;
    try {
      await contract.connect(outsider).createProof(documentHash, "purchase_agreement", "proof-001");
    } catch {
      outsiderFailed = true;
    }
    expect(outsiderFailed).to.equal(true);

    await (await contract.createProof(documentHash, "purchase_agreement", "proof-001")).wait();
    const event = (await contract.queryFilter(contract.filters.ProofCreated()))[0];
    const proofId = event.args.proofId;

    const proof = await contract.getProof(proofId);
    expect(proof.proofType).to.equal("purchase_agreement");
    expect(await contract.verifyDocument(proofId, documentHash)).to.equal(true);

    await (await contract.updateProofStatus(proofId, 1)).wait();
    const updated = await contract.getProof(proofId);
    expect(updated.status).to.equal(BigInt(1));
  });
});
