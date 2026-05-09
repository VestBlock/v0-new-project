import { expect } from "chai";
import hre from "hardhat";

describe("PartnerPay", function () {
  it("creates a payout deal, adds splits, locks it, and marks a split paid", async function () {
    const { ethers } = hre;
    const [admin, participant] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("PartnerPay");
    const contract = (await factory.deploy(admin.address)) as any;
    await contract.waitForDeployment();

    await (await contract.createDeal("partner-pay-001", BigInt(125000))).wait();
    const createdEvent = (await contract.queryFilter(contract.filters.DealCreated()))[0];
    const dealId = createdEvent.args.dealId;

    await (await contract.addSplit(dealId, participant.address, "Finder", 4000)).wait();
    await (await contract.addSplit(dealId, admin.address, "Dispo", 6000)).wait();
    let overflowFailed = false;
    try {
      await contract.addSplit(dealId, admin.address, "Overflow", 1);
    } catch {
      overflowFailed = true;
    }
    expect(overflowFailed).to.equal(true);

    const dealBeforeLock = await contract.getDeal(dealId);
    expect(dealBeforeLock.status).to.equal(BigInt(1));

    await (await contract.lockDeal(dealId)).wait();
    await (await contract.markSplitPaid(dealId, 0)).wait();

    const splits = await contract.getDealSplits(dealId);
    expect(splits).to.have.length(2);
    expect(splits[0].paid).to.equal(true);
  });
});
