// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PartnerPay is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant DEAL_CREATOR_ROLE = keccak256("DEAL_CREATOR_ROLE");
    bytes32 public constant DEAL_MANAGER_ROLE = keccak256("DEAL_MANAGER_ROLE");

    enum DealStatus {
        DRAFT,
        ACTIVE,
        LOCKED,
        CLOSED,
        CANCELLED
    }

    struct Deal {
        bytes32 dealId;
        address creator;
        string externalRef;
        uint256 dealAmount;
        DealStatus status;
        uint256 createdAt;
        uint256 updatedAt;
        bool exists;
    }

    struct Split {
        address participant;
        string participantName;
        uint16 bps;
        bool paid;
        uint256 paidAt;
    }

    mapping(bytes32 => Deal) private deals;
    mapping(bytes32 => Split[]) private splits;
    mapping(bytes32 => uint16) public totalBps;
    uint256 public totalDeals;

    event DealCreated(bytes32 indexed dealId, address indexed creator, string externalRef, uint256 dealAmount);
    event SplitAdded(bytes32 indexed dealId, uint256 indexed splitIndex, address indexed participant, string participantName, uint16 bps);
    event DealLocked(bytes32 indexed dealId, uint256 lockedAt);
    event DealStatusUpdated(bytes32 indexed dealId, DealStatus indexed previousStatus, DealStatus indexed newStatus, address updatedBy);
    event SplitMarkedPaid(bytes32 indexed dealId, uint256 indexed splitIndex, address indexed participant, uint256 paidAt);

    error EmptyExternalRef();
    error DealDoesNotExist(bytes32 dealId);
    error InvalidParticipant();
    error InvalidBps();
    error BpsExceedsMax();
    error InvalidStatusTransition(DealStatus current, DealStatus next);
    error SplitIndexOutOfRange(uint256 index);
    error SplitAlreadyPaid(uint256 index);

    constructor(address admin) {
        require(admin != address(0), "PartnerPay: zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(DEAL_CREATOR_ROLE, admin);
        _grantRole(DEAL_MANAGER_ROLE, admin);
    }

    function createDeal(string calldata externalRef, uint256 dealAmount)
        external
        whenNotPaused
        onlyRole(DEAL_CREATOR_ROLE)
        returns (bytes32 dealId)
    {
        if (bytes(externalRef).length == 0) revert EmptyExternalRef();

        dealId = keccak256(abi.encode(msg.sender, externalRef, dealAmount, block.chainid, totalDeals));
        deals[dealId] = Deal({
            dealId: dealId,
            creator: msg.sender,
            externalRef: externalRef,
            dealAmount: dealAmount,
            status: DealStatus.DRAFT,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            exists: true
        });

        unchecked {
            ++totalDeals;
        }

        emit DealCreated(dealId, msg.sender, externalRef, dealAmount);
    }

    function addSplit(bytes32 dealId, address participant, string calldata participantName, uint16 bps)
        external
        whenNotPaused
        onlyRole(DEAL_CREATOR_ROLE)
    {
        Deal storage deal = deals[dealId];
        if (!deal.exists) revert DealDoesNotExist(dealId);
        if (participant == address(0)) revert InvalidParticipant();
        if (bps == 0 || bps > 10000) revert InvalidBps();
        if (totalBps[dealId] + bps > 10000) revert BpsExceedsMax();

        splits[dealId].push(Split({
            participant: participant,
            participantName: participantName,
            bps: bps,
            paid: false,
            paidAt: 0
        }));

        totalBps[dealId] += bps;
        if (deal.status == DealStatus.DRAFT) {
            deal.status = DealStatus.ACTIVE;
        }
        deal.updatedAt = block.timestamp;

        emit SplitAdded(dealId, splits[dealId].length - 1, participant, participantName, bps);
    }

    function lockDeal(bytes32 dealId) external whenNotPaused onlyRole(DEAL_MANAGER_ROLE) {
        Deal storage deal = deals[dealId];
        if (!deal.exists) revert DealDoesNotExist(dealId);
        if (deal.status != DealStatus.ACTIVE) revert InvalidStatusTransition(deal.status, DealStatus.LOCKED);

        DealStatus previous = deal.status;
        deal.status = DealStatus.LOCKED;
        deal.updatedAt = block.timestamp;
        emit DealStatusUpdated(dealId, previous, DealStatus.LOCKED, msg.sender);
        emit DealLocked(dealId, block.timestamp);
    }

    function updateDealStatus(bytes32 dealId, uint8 statusCode)
        external
        whenNotPaused
        onlyRole(DEAL_MANAGER_ROLE)
        nonReentrant
    {
        Deal storage deal = deals[dealId];
        if (!deal.exists) revert DealDoesNotExist(dealId);

        DealStatus nextStatus = DealStatus(statusCode);
        bool valid =
            (deal.status == DealStatus.DRAFT || deal.status == DealStatus.ACTIVE) && nextStatus == DealStatus.CANCELLED
            || deal.status == DealStatus.LOCKED && (nextStatus == DealStatus.CLOSED || nextStatus == DealStatus.CANCELLED);

        if (!valid) revert InvalidStatusTransition(deal.status, nextStatus);

        DealStatus previous = deal.status;
        deal.status = nextStatus;
        deal.updatedAt = block.timestamp;
        emit DealStatusUpdated(dealId, previous, nextStatus, msg.sender);
    }

    function markSplitPaid(bytes32 dealId, uint256 splitIndex)
        external
        whenNotPaused
        onlyRole(DEAL_MANAGER_ROLE)
        nonReentrant
    {
        if (!deals[dealId].exists) revert DealDoesNotExist(dealId);
        if (splitIndex >= splits[dealId].length) revert SplitIndexOutOfRange(splitIndex);
        if (splits[dealId][splitIndex].paid) revert SplitAlreadyPaid(splitIndex);

        splits[dealId][splitIndex].paid = true;
        splits[dealId][splitIndex].paidAt = block.timestamp;
        emit SplitMarkedPaid(dealId, splitIndex, splits[dealId][splitIndex].participant, block.timestamp);
    }

    function getDeal(bytes32 dealId) external view returns (Deal memory) {
        Deal memory deal = deals[dealId];
        if (!deal.exists) revert DealDoesNotExist(dealId);
        return deal;
    }

    function getDealSplits(bytes32 dealId) external view returns (Split[] memory) {
        if (!deals[dealId].exists) revert DealDoesNotExist(dealId);
        return splits[dealId];
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}

