// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ISupplyChain {
    function isSealed(uint256 productId) external view returns (bool);
    function sealedRoot(uint256 productId) external view returns (bytes32);
}

interface IVerifier {
    // UPDATED: Now accepts uint[3] because your circuit has 3 public inputs
    function verifyProof(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[3] calldata input // <--- CHANGED to 3
    ) external view returns (bool);
}

contract Insurance {
    ISupplyChain public supplyChain;
    IVerifier public verifier;

    struct Policy {
        address shipper;
        address buyer;
        uint256 depositAmount;
        uint256 deadline;
        bool isResolved;
    }

    mapping(uint256 => Policy) public policies;

    constructor(address _supplyChainAddress, address _verifierAddress) {
        supplyChain = ISupplyChain(_supplyChainAddress);
        verifier = IVerifier(_verifierAddress);
    }

    function createPolicy(uint256 productId, address buyer, uint256 durationInSeconds) external payable {
        require(msg.value > 0, "Deposit required");
        policies[productId] = Policy({
            shipper: msg.sender,
            buyer: buyer,
            depositAmount: msg.value,
            deadline: block.timestamp + durationInSeconds,
            isResolved: false
        });
    }

    // UPDATED: Input size changed to 3
    function settleClaim(
        uint256 productId,
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[3] calldata input // <--- CHANGED to 3
    ) external {
        Policy storage p = policies[productId];
        require(p.depositAmount > 0, "No policy found");
        require(!p.isResolved, "Already resolved");

        require(supplyChain.isSealed(productId), "Shipment not sealed");

        // Verify Root (input[0]) matches Chain
        bytes32 onChainRoot = supplyChain.sealedRoot(productId);
        require(uint256(onChainRoot) == input[0], "Root mismatch");

        // Verify Proof
        require(verifier.verifyProof(a, b, c, input), "Invalid ZK Proof");

        p.isResolved = true;
        uint256 amount = p.depositAmount;
        p.depositAmount = 0;

        // input[1] is the breach flag
        if (input[1] == 1) {
            payable(p.buyer).transfer(amount);
        } else {
            payable(p.shipper).transfer(amount);
        }
    }
}