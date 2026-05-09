import { expect } from "chai";
import hre from "hardhat";

describe("DealVaultRealEstate", function () {
  it("creates deals, updates status, and attaches proofs", async function () {
    const { ethers } = hre;
    const [admin, outsider] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("DealVaultRealEstate");
    const contract = (await factory.deploy(admin.address)) as any;
    await contract.waitForDeployment();

    const propertyHash = ethers.keccak256(ethers.toUtf8Bytes("123 test st|dallas|tx|75001"));
    const proofId = ethers.keccak256(ethers.toUtf8Bytes("proof-1"));

    const createTx = await contract.createDeal(propertyHash, 0, "deal-001");
    await createTx.wait();
    expect(await contract.totalDeals()).to.equal(BigInt(1));

    const createdEvent = (await contract.queryFilter(contract.filters.DealCreated()))[0];
    const createdDealId = createdEvent.args.dealId;
    const deal = await contract.getDeal(createdDealId);
    expect(deal.externalRef).to.equal("deal-001");
    expect(deal.status).to.equal(BigInt(0));

    let outsiderFailed = false;
    try {
      await contract.connect(outsider).createDeal(propertyHash, 0, "deal-003");
    } catch {
      outsiderFailed = true;
    }
    expect(outsiderFailed).to.equal(true);

    await (await contract.updateDealStatus(createdDealId, 1)).wait();
    await (await contract.updateDealStatus(createdDealId, 3)).wait();
    await (await contract.attachProof(createdDealId, proofId)).wait();

    const proofs = await contract.getDealProofs(createdDealId);
    expect(proofs).to.deep.equal([proofId]);
    const updatedDeal = await contract.getDeal(createdDealId);
    expect(updatedDeal.status).to.equal(BigInt(3));
  });
});
