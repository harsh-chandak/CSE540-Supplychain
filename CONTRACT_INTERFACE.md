# SupplyChain Contract — Public Interface (Draft)

This document lists the **public surface** of `SupplyChain.sol` (Solidity ^0.8.19) with **detailed, human-readable comments**.
Use it together with the in-code comments for grading and implementation reviews.

- **Purpose**: provenance tracking + **Proof‑of‑Cold** anchors (Merkle *window roots* + *seal*).
- **Design**: small, readable, and demo‑friendly; relies on events and simple role checks.
- **Scope (draft)**: no ZK verifier yet — this interface prepares anchors the verifier will later reference.

> Legend: _RO_ = read‑only (view), _TX_ = state‑changing (transaction)

---

## Types

```solidity
/// @notice Lifecycle checkpoints you can mark on a product.
enum Status { Created, Shipped, Received, Delivered }
```

---

## Events

```solidity
/// @notice Emitted when a new product is registered.
/// @param productId Autoincremented id for the product
/// @param manufacturer Address that registered the product (also initial owner)
/// @param sku Human-friendly identifier (e.g., "SKU-001")
/// @param metadataURI URI to off-chain metadata (ipfs://CID or https://...)
event ProductRegistered(
    uint256 indexed productId,
    address indexed manufacturer,
    string sku,
    string metadataURI
);

/// @notice Emitted when custody changes hands.
/// @param productId Id of the product
/// @param from Previous owner
/// @param to New owner
/// @param notes Free text, e.g., "Shipped to retailer"
event CustodyTransferred(
    uint256 indexed productId,
    address indexed from,
    address indexed to,
    string notes
);

/// @notice Emitted when lifecycle status is updated.
/// @param productId Id of the product
/// @param status New status (Created/Shipped/Received/Delivered)
/// @param notes Free text, e.g., "Arrived at DC-12"
event StatusUpdated(
    uint256 indexed productId,
    Status status,
    string notes
);

/// @notice Emitted when a regulator certifies a product.
event ProductCertified(
    uint256 indexed productId,
    address indexed regulator,
    string note
);

/// @notice Emitted each time the gateway posts the next Merkle root
///         for a short time window of readings (tamper-evident receipt).
/// @param productId Shipment/product id
/// @param windowIdx Strictly increasing window index: 1,2,3,...
/// @param root Merkle root (32-byte hash) for this window
/// @param ts Block timestamp at commit
event WindowCommitted(
    uint256 indexed productId,
    uint32 indexed windowIdx,
    bytes32 root,
    uint64 ts
);

/// @notice Emitted once at delivery to finalize the diary of window roots.
/// @param productId Shipment/product id
/// @param rootOfRoots A single root that commits all window roots in order
/// @param ts Block timestamp at sealing
event ShipmentSealed(
    uint256 indexed productId,
    bytes32 rootOfRoots,
    uint64 ts
);

/// @notice Admin role management events.
event RegulatorUpdated(address indexed account, bool allowed);
event CommitterUpdated(address indexed account, bool allowed);
```

---

## Read‑only public variables (Solidity auto‑getters)

```solidity
function admin() external view returns (address);            // RO: deployer/admin
function regulators(address) external view returns (bool);   // RO: is regulator?
function committers(address) external view returns (bool);   // RO: is committer?
function windowRoot(uint256 productId, uint32 w) external view returns (bytes32); // RO: per-window root
function lastCommittedWindow(uint256 productId) external view returns (uint32);   // RO: highest window index
function sealedRoot(uint256 productId) external view returns (bytes32);           // RO: final root-of-roots
```

---

## Admin / Roles

```solidity
/// @notice Admin toggles regulator status for an address.
/// @dev    Regulators can call `certify`.
/// @param  account Address to (de)authorize
/// @param  allowed True to grant, false to revoke
/// @custom.access onlyAdmin (tx reverts if caller != admin)
function setRegulator(address account, bool allowed) external;

/// @notice Admin toggles committer status for an address.
/// @dev    Committers can call `commitWindowRoot` (e.g., your gateway key).
/// @param  account Address to (de)authorize
/// @param  allowed True to grant, false to revoke
/// @custom.access onlyAdmin
function setCommitter(address account, bool allowed) external;
```

**Why these roles?**  
- *Regulator*: minimal governance to mark “certified”.  
- *Committer*: prevents random accounts from spamming window roots; makes gateway-controlled ingress explicit.

---

## Product: Register / Read / List

```solidity
/// @notice Create a new product; manufacturer and first owner are the caller.
/// @dev    Reverts if `sku` is empty.
/// @param  sku A short, human-friendly identifier, e.g., "SKU-001".
/// @param  metadataURI URI to richer metadata (ipfs://CID or https://...).
/// @return productId Autoincremented id for the newly registered product.
/// @emits  ProductRegistered(productId, msg.sender, sku, metadataURI).
/// @effects Writes a new Product struct, pushes id to `productIds`.
/// @custom.access Any EOA/contract may call.
function registerProduct(string calldata sku, string calldata metadataURI)
  external returns (uint256 productId);
```

```solidity
/// @notice Read all core fields for a product (easy for UIs/Remix).
/// @dev    Reverts if product does not exist.
/// @param  productId The product/shipment id.
/// @return id, manufacturer, currentOwner, sku, metadataURI, createdAt, status, certified.
function getProduct(uint256 productId) external view returns (
  uint256 id,
  address manufacturer,
  address currentOwner,
  string memory sku,
  string memory metadataURI,
  uint256 createdAt,
  Status status,
  bool certified
);
```

```solidity
/// @notice List all product ids (for a simple table view).
/// @return ids Array of product ids in registration order.
function getAllProductIds() external view returns (uint256[] memory);

/// @notice Total number of registered products.
function totalProducts() external view returns (uint256);

/// @notice Convenience getter for current owner of a product.
/// @dev    Reverts if product does not exist.
function currentOwnerOf(uint256 productId) external view returns (address);
```

---

## Custody & Status

```solidity
/// @notice Transfer custody to a new owner.
/// @dev    Requirements:
///         - Caller must be the current owner.
///         - `to` must be non-zero.
/// @param  productId The product id to transfer.
/// @param  to New owner address.
/// @param  notes Free text (e.g., "Shipped to retailer").
/// @emits  CustodyTransferred(productId, from, to, notes).
/// @effects Updates `currentOwner`.
/// @custom.access Only current owner.
function transferCustody(uint256 productId, address to, string calldata notes) external;
```

```solidity
/// @notice Update lifecycle status (Created/Shipped/Received/Delivered).
/// @dev    Caller must be current owner or manufacturer.
/// @param  productId The product id.
/// @param  newStatus The new status value.
/// @param  notes Free text (optional context).
/// @emits  StatusUpdated(productId, newStatus, notes).
/// @effects Writes new status.
/// @custom.access Owner or manufacturer.
function updateStatus(uint256 productId, Status newStatus, string calldata notes) external;
```

```solidity
/// @notice Mark a product as certified by a regulator.
/// @dev    Caller must be a regulator (set by admin).
/// @param  productId The product id.
/// @param  note Optional certification note.
/// @emits  ProductCertified(productId, msg.sender, note).
/// @effects Sets `certified = true`.
/// @custom.access Regulator only.
function certify(uint256 productId, string calldata note) external;
```

---

## Proof‑of‑Cold Timeline (Window Roots + Seal)

**Why this exists**  
- To avoid posting raw sensor data on-chain, we post small **hash receipts** for short **windows**.  
- This gives a **tamper‑evident** trail and a single **sealed root** that future **ZK proofs** can target.

```solidity
/// @notice Append the next Merkle root for a short time window of readings.
/// @dev    Requirements:
///         - Product must exist and not be sealed.
///         - `windowIdx` must be exactly `lastCommittedWindow(productId) + 1`.
///         - Caller must be an allowed committer (gateway).
/// @param  productId Product/shipment id.
/// @param  windowIdx Strictly increasing window index: 1,2,3,...
/// @param  root Merkle root (32 bytes) computed from readings within this window.
/// @emits  WindowCommitted(productId, windowIdx, root, block.timestamp).
/// @effects Stores the root and advances `lastCommittedWindow`.
/// @custom.access onlyCommitter.
function commitWindowRoot(uint256 productId, uint32 windowIdx, bytes32 root) external;
```

```solidity
/// @notice Finalize the diary by storing a single "root of roots" that commits all window roots.
/// @dev    After sealing, further `commitWindowRoot` calls revert.
///         The contract cannot by itself check that `rootOfRoots` matches prior window roots;
///         that link is enforced at proof time by referencing `sealedRoot(productId)`.
/// @param  productId Product/shipment id.
/// @param  rootOfRoots A Merkle root that commits all window roots in order.
/// @emits  ShipmentSealed(productId, rootOfRoots, block.timestamp).
/// @effects Sets `sealedRoot(productId)` and blocks further commits.
/// @custom.access Only manufacturer or current owner.
function stopAndSeal(uint256 productId, bytes32 rootOfRoots) external;
```

```solidity
/// @notice Is this shipment sealed (i.e., no more commits allowed)?
function isSealed(uint256 productId) external view returns (bool);

/// @notice Read the highest window index that has been committed so far.
function lastCommittedWindow(uint256 productId) external view returns (uint32);
```

---

## Invariants & Failure Modes (Design Notes)

- **Valid IDs**: Every mutating/read function internally checks `exists`; invalid ids revert with `"unknown productId"`.
- **Custody**: Only the current owner can transfer; `to` must be non‑zero.
- **Status**: Only current owner or manufacturer may update.
- **Regulatory**: Only addresses whitelisted by admin may call `certify`.
- **Window commits**: Only committers; window order strictly increasing; rejected after sealing.
- **Seal**: Only manufacturer or current owner; one‑way (cannot unseal).

**Security basics**
- Emits indexed events for all key actions → easy off‑chain auditing.
- Minimal role surface; clear, explicit caller checks at every state change.
- No raw sensor data is stored on‑chain; only hashes to preserve privacy and reduce gas.

---

## How this links to ZK verification (later milestone)

- The prover builds a ZK proof that a condition (e.g., “time over 8 °C ≥ 10 minutes”) holds for readings committed to the **window roots**.
- The proof includes the **final sealed root** (`sealedRoot(productId)`) as a **public input** so the verifier can check the proof refers to *this exact* shipment.
- On success, a separate escrow contract can **settle** automatically (payout/refund).
