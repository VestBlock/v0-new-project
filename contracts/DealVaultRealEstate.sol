// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract DealVaultRealEstate is AccessControl, Pausable {
    bytes32 public constant DEAL_CREATOR_ROLE = keccak256("DEAL_CREATOR_ROLE");
    bytes32 public constant DEAL_MANAGER_ROLE = keccak256("DEAL_MANAGER_ROLE");

    enum DealType {
        WHOLESALE_ASSIGNMENT,
        JV_SPLIT,
        CONTRACTOR_REHAB,
        SELLER_FINANCE,
        RENT_TO_OWN,
        REFERRAL,
        OTHER
    }

    enum DealStatus {
        DRAFT,
        ACTIVE,
        UNDER_CONTRACT,
        LOCKED,
        CLOSED,
        CANCELLED,
        DISPUTED
    }

    struct DealRecord {
        bytes32 dealId;
        bytes32 propertyHash;
        address creator;
        DealType dealType;
        DealStatus status;
        string externalRef;
        uint256 createdAt;
        uint256 updatedAt;
        bool exists;
    }

    mapping(bytes32 => DealRecord) private deals;
    mapping(bytes32 => bytes32[]) private dealProofs;
    uint256 public totalDeals;

    event DealCreated(
        bytes32 indexed dealId,
        bytes32 indexed propertyHash,
        address indexed creator,
        DealType dealType,
        string externalRef,
        uint256 createdAt
    );
    event DealStatusUpdated(
        bytes32 indexed dealId,
        DealStatus indexed previousStatus,
        DealStatus indexed newStatus,
        address updatedBy,
        uint256 updatedAt
    );
    event DealProofAttached(bytes32 indexed dealId, bytes32 indexed proofId, address indexed attachedBy);

    error InvalidPropertyHash();
    error EmptyExternalRef();
    error DealDoesNotExist(bytes32 dealId);
    error InvalidProofId();
    error InvalidStatusTransition(DealStatus current, DealStatus next);

    constructor(address admin) {
        require(admin != address(0), "DealVault: zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(DEAL_CREATOR_ROLE, admin);
        _grantRole(DEAL_MANAGER_ROLE, admin);
    }

    function createDeal(bytes32 propertyHash, DealType dealType, string calldata externalRef)
        external
        whenNotPaused
        onlyRole(DEAL_CREATOR_ROLE)
        returns (bytes32 dealId)
    {
        if (propertyHash == bytes32(0)) revert InvalidPropertyHash();
        if (bytes(externalRef).length == 0) revert EmptyExternalRef();

        dealId = keccak256(abi.encode(msg.sender, propertyHash, dealType, externalRef, block.chainid, totalDeals));
        deals[dealId] = DealRecord({
            dealId: dealId,
            propertyHash: propertyHash,
            creator: msg.sender,
            dealType: dealType,
            status: DealStatus.DRAFT,
            externalRef: externalRef,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            exists: true
        });

        unchecked {
            ++totalDeals;
        }

        emit DealCreated(dealId, propertyHash, msg.sender, dealType, externalRef, block.timestamp);
    }

    function updateDealStatus(bytes32 dealId, DealStatus nextStatus)
        external
        whenNotPaused
        onlyRole(DEAL_MANAGER_ROLE)
    {
        DealRecord storage deal = deals[dealId];
        if (!deal.exists) revert DealDoesNotExist(dealId);

        DealStatus current = deal.status;
        bool valid;

        if (current == DealStatus.DRAFT && (nextStatus == DealStatus.ACTIVE || nextStatus == DealStatus.CANCELLED)) valid = true;
        else if (
            current == DealStatus.ACTIVE &&
            (nextStatus == DealStatus.UNDER_CONTRACT || nextStatus == DealStatus.LOCKED || nextStatus == DealStatus.DISPUTED || nextStatus == DealStatus.CANCELLED)
        ) valid = true;
        else if (
            current == DealStatus.UNDER_CONTRACT &&
            (nextStatus == DealStatus.LOCKED || nextStatus == DealStatus.CLOSED || nextStatus == DealStatus.DISPUTED || nextStatus == DealStatus.CANCELLED)
        ) valid = true;
        else if (
            current == DealStatus.LOCKED &&
            (nextStatus == DealStatus.CLOSED || nextStatus == DealStatus.DISPUTED || nextStatus == DealStatus.CANCELLED)
        ) valid = true;
        else if (current == DealStatus.DISPUTED && (nextStatus == DealStatus.ACTIVE || nextStatus == DealStatus.CANCELLED)) valid = true;

        if (!valid) revert InvalidStatusTransition(current, nextStatus);

        deal.status = nextStatus;
        deal.updatedAt = block.timestamp;
        emit DealStatusUpdated(dealId, current, nextStatus, msg.sender, block.timestamp);
    }

    function attachProof(bytes32 dealId, bytes32 proofId)
        external
        whenNotPaused
        onlyRole(DEAL_MANAGER_ROLE)
    {
        DealRecord storage deal = deals[dealId];
        if (!deal.exists) revert DealDoesNotExist(dealId);
        if (proofId == bytes32(0)) revert InvalidProofId();

        dealProofs[dealId].push(proofId);
        deal.updatedAt = block.timestamp;
        emit DealProofAttached(dealId, proofId, msg.sender);
    }

    function getDeal(bytes32 dealId) external view returns (DealRecord memory) {
        DealRecord memory deal = deals[dealId];
        if (!deal.exists) revert DealDoesNotExist(dealId);
        return deal;
    }

    function getDealProofs(bytes32 dealId) external view returns (bytes32[] memory) {
        if (!deals[dealId].exists) revert DealDoesNotExist(dealId);
        return dealProofs[dealId];
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}

