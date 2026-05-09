import { expect } from "chai";
import hre from "hardhat";

describe("MilestoneVault", function () {
  it("creates a project and moves a milestone through the approval workflow", async function () {
    const { ethers } = hre;
    const [admin] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("MilestoneVault");
    const contract = (await factory.deploy(admin.address)) as any;
    await contract.waitForDeployment();

    await (await contract.createProject("rehab-001", "contractor_rehab", BigInt(550000))).wait();
    const projectEvent = (await contract.queryFilter(contract.filters.ProjectCreated()))[0];
    const projectId = projectEvent.args.projectId;

    await (
      await contract.addMilestone(
        projectId,
        "Demo",
        "Interior demolition",
        BigInt(100000),
        BigInt(1800000000)
      )
    ).wait();

    const proofId = ethers.keccak256(ethers.toUtf8Bytes("proof-demo-001"));
    await (await contract.submitMilestoneProof(projectId, 0, proofId)).wait();
    await (await contract.approveMilestone(projectId, 0)).wait();
    await (await contract.completeMilestone(projectId, 0)).wait();

    const milestones = await contract.getMilestones(projectId);
    expect(milestones).to.have.length(1);
    expect(milestones[0].status).to.equal(BigInt(4));
    expect(milestones[0].proofId).to.equal(proofId);
  });
});
