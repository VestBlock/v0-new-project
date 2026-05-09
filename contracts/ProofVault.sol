// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract ProofVault is AccessControl, Pausable {
    bytes32 public constant PROOF_CREATOR_ROLE = keccak256("PROOF_CREATOR_ROLE");
    bytes32 public constant STATUS_MANAGER_ROLE = keccak256("STATUS_MANAGER_ROLE");

    enum ProofStatus {
        ACTIVE,
        REVOKED,
        SUPERSEDED
    }

    struct ProofRecord {
        bytes32 proofId;
        bytes32 documentHash;
        address creator;
        string proofType;
        string externalRef;
        ProofStatus status;
        uint256 createdAt;
        uint256 updatedAt;
        bool exists;
    }

    mapping(bytes32 => ProofRecord) private proofs;
    uint256 public totalProofs;

    event ProofCreated(
        bytes32 indexed proofId,
        bytes32 indexed documentHash,
        address indexed creator,
        string proofType,
        string externalRef,
        uint256 createdAt
    );
    event ProofStatusUpdated(
        bytes32 indexed proofId,
        ProofStatus indexed previousStatus,
        ProofStatus indexed newStatus,
        address updatedBy,
        uint256 updatedAt
    );

    error InvalidDocumentHash();
    error EmptyProofType();
    error ProofDoesNotExist(bytes32 proofId);
    error InvalidStatusTransition(ProofStatus current, ProofStatus next);

    constructor(address admin) {
        require(admin != address(0), "ProofVault: zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PROOF_CREATOR_ROLE, admin);
        _grantRole(STATUS_MANAGER_ROLE, admin);
    }

    function createProof(bytes32 documentHash, string calldata proofType, string calldata externalRef)
        external
        whenNotPaused
        onlyRole(PROOF_CREATOR_ROLE)
        returns (bytes32 proofId)
    {
        if (documentHash == bytes32(0)) revert InvalidDocumentHash();
        if (bytes(proofType).length == 0) revert EmptyProofType();

        proofId = keccak256(abi.encode(msg.sender, documentHash, proofType, externalRef, block.chainid, totalProofs));

        proofs[proofId] = ProofRecord({
            proofId: proofId,
            documentHash: documentHash,
            creator: msg.sender,
            proofType: proofType,
            externalRef: externalRef,
            status: ProofStatus.ACTIVE,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            exists: true
        });

        unchecked {
            ++totalProofs;
        }

        emit ProofCreated(proofId, documentHash, msg.sender, proofType, externalRef, block.timestamp);
    }

    function updateProofStatus(bytes32 proofId, uint8 statusCode)
        external
        whenNotPaused
        onlyRole(STATUS_MANAGER_ROLE)
    {
        ProofRecord storage proof = proofs[proofId];
        if (!proof.exists) revert ProofDoesNotExist(proofId);

        ProofStatus nextStatus = ProofStatus(statusCode);
        bool valid =
            proof.status == ProofStatus.ACTIVE &&
            (nextStatus == ProofStatus.REVOKED || nextStatus == ProofStatus.SUPERSEDED);

        if (!valid) revert InvalidStatusTransition(proof.status, nextStatus);

        ProofStatus previous = proof.status;
        proof.status = nextStatus;
        proof.updatedAt = block.timestamp;
        emit ProofStatusUpdated(proofId, previous, nextStatus, msg.sender, block.timestamp);
    }

    function getProof(bytes32 proofId) external view returns (ProofRecord memory) {
        ProofRecord memory proof = proofs[proofId];
        if (!proof.exists) revert ProofDoesNotExist(proofId);
        return proof;
    }

    function verifyDocument(bytes32 proofId, bytes32 documentHash) external view returns (bool) {
        ProofRecord memory proof = proofs[proofId];
        if (!proof.exists) return false;
        return proof.documentHash == documentHash;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}

