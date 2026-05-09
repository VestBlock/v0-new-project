// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract MilestoneVault is AccessControl, Pausable {
    bytes32 public constant PROJECT_CREATOR_ROLE = keccak256("PROJECT_CREATOR_ROLE");
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");

    enum MilestoneStatus {
        PENDING,
        SUBMITTED,
        APPROVED,
        DISPUTED,
        COMPLETED,
        CANCELLED
    }

    struct Project {
        bytes32 projectId;
        address creator;
        string externalRef;
        string projectType;
        uint256 totalAmount;
        bool exists;
    }

    struct Milestone {
        string title;
        string description;
        uint256 amount;
        uint256 dueDate;
        bytes32 proofId;
        MilestoneStatus status;
        uint256 updatedAt;
    }

    mapping(bytes32 => Project) private projects;
    mapping(bytes32 => Milestone[]) private milestones;
    uint256 public totalProjects;

    event ProjectCreated(bytes32 indexed projectId, address indexed creator, string externalRef, string projectType, uint256 totalAmount);
    event MilestoneAdded(bytes32 indexed projectId, uint256 indexed milestoneIndex, string title, uint256 amount, uint256 dueDate);
    event MilestoneProofSubmitted(bytes32 indexed projectId, uint256 indexed milestoneIndex, bytes32 indexed proofId);
    event MilestoneApproved(bytes32 indexed projectId, uint256 indexed milestoneIndex, address indexed approver);
    event MilestoneDisputed(bytes32 indexed projectId, uint256 indexed milestoneIndex, address indexed disputer);
    event MilestoneCompleted(bytes32 indexed projectId, uint256 indexed milestoneIndex, address indexed completer);

    error EmptyExternalRef();
    error EmptyProjectType();
    error EmptyMilestoneTitle();
    error ProjectDoesNotExist(bytes32 projectId);
    error MilestoneIndexOutOfRange(uint256 index);
    error InvalidStatusTransition(MilestoneStatus current, MilestoneStatus next);
    error InvalidProofId();

    constructor(address admin) {
        require(admin != address(0), "MilestoneVault: zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PROJECT_CREATOR_ROLE, admin);
        _grantRole(APPROVER_ROLE, admin);
    }

    function createProject(string calldata externalRef, string calldata projectType, uint256 totalAmount)
        external
        whenNotPaused
        onlyRole(PROJECT_CREATOR_ROLE)
        returns (bytes32 projectId)
    {
        if (bytes(externalRef).length == 0) revert EmptyExternalRef();
        if (bytes(projectType).length == 0) revert EmptyProjectType();

        projectId = keccak256(abi.encode(msg.sender, externalRef, projectType, totalAmount, block.chainid, totalProjects));
        projects[projectId] = Project({
            projectId: projectId,
            creator: msg.sender,
            externalRef: externalRef,
            projectType: projectType,
            totalAmount: totalAmount,
            exists: true
        });

        unchecked {
            ++totalProjects;
        }

        emit ProjectCreated(projectId, msg.sender, externalRef, projectType, totalAmount);
    }

    function addMilestone(
        bytes32 projectId,
        string calldata title,
        string calldata description,
        uint256 amount,
        uint256 dueDate
    ) external whenNotPaused onlyRole(PROJECT_CREATOR_ROLE) {
        if (!projects[projectId].exists) revert ProjectDoesNotExist(projectId);
        if (bytes(title).length == 0) revert EmptyMilestoneTitle();

        milestones[projectId].push(Milestone({
            title: title,
            description: description,
            amount: amount,
            dueDate: dueDate,
            proofId: bytes32(0),
            status: MilestoneStatus.PENDING,
            updatedAt: block.timestamp
        }));

        emit MilestoneAdded(projectId, milestones[projectId].length - 1, title, amount, dueDate);
    }

    function submitMilestoneProof(bytes32 projectId, uint256 milestoneIndex, bytes32 proofId)
        external
        whenNotPaused
        onlyRole(PROJECT_CREATOR_ROLE)
    {
        if (proofId == bytes32(0)) revert InvalidProofId();
        Milestone storage milestone = _getMilestone(projectId, milestoneIndex);
        if (milestone.status != MilestoneStatus.PENDING && milestone.status != MilestoneStatus.DISPUTED) {
            revert InvalidStatusTransition(milestone.status, MilestoneStatus.SUBMITTED);
        }

        milestone.status = MilestoneStatus.SUBMITTED;
        milestone.proofId = proofId;
        milestone.updatedAt = block.timestamp;
        emit MilestoneProofSubmitted(projectId, milestoneIndex, proofId);
    }

    function approveMilestone(bytes32 projectId, uint256 milestoneIndex)
        external
        whenNotPaused
        onlyRole(APPROVER_ROLE)
    {
        Milestone storage milestone = _getMilestone(projectId, milestoneIndex);
        if (milestone.status != MilestoneStatus.SUBMITTED) {
            revert InvalidStatusTransition(milestone.status, MilestoneStatus.APPROVED);
        }

        milestone.status = MilestoneStatus.APPROVED;
        milestone.updatedAt = block.timestamp;
        emit MilestoneApproved(projectId, milestoneIndex, msg.sender);
    }

    function disputeMilestone(bytes32 projectId, uint256 milestoneIndex)
        external
        whenNotPaused
        onlyRole(APPROVER_ROLE)
    {
        Milestone storage milestone = _getMilestone(projectId, milestoneIndex);
        if (milestone.status != MilestoneStatus.SUBMITTED && milestone.status != MilestoneStatus.APPROVED) {
            revert InvalidStatusTransition(milestone.status, MilestoneStatus.DISPUTED);
        }

        milestone.status = MilestoneStatus.DISPUTED;
        milestone.updatedAt = block.timestamp;
        emit MilestoneDisputed(projectId, milestoneIndex, msg.sender);
    }

    function completeMilestone(bytes32 projectId, uint256 milestoneIndex)
        external
        whenNotPaused
        onlyRole(APPROVER_ROLE)
    {
        Milestone storage milestone = _getMilestone(projectId, milestoneIndex);
        if (milestone.status != MilestoneStatus.APPROVED) {
            revert InvalidStatusTransition(milestone.status, MilestoneStatus.COMPLETED);
        }

        milestone.status = MilestoneStatus.COMPLETED;
        milestone.updatedAt = block.timestamp;
        emit MilestoneCompleted(projectId, milestoneIndex, msg.sender);
    }

    function getProject(bytes32 projectId) external view returns (Project memory) {
        Project memory project = projects[projectId];
        if (!project.exists) revert ProjectDoesNotExist(projectId);
        return project;
    }

    function getMilestones(bytes32 projectId) external view returns (Milestone[] memory) {
        if (!projects[projectId].exists) revert ProjectDoesNotExist(projectId);
        return milestones[projectId];
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _getMilestone(bytes32 projectId, uint256 milestoneIndex) internal view returns (Milestone storage) {
        if (!projects[projectId].exists) revert ProjectDoesNotExist(projectId);
        if (milestoneIndex >= milestones[projectId].length) revert MilestoneIndexOutOfRange(milestoneIndex);
        return milestones[projectId][milestoneIndex];
    }
}

