# ZK–ColdChain: Private Compliance Proofs With Parametric Payouts – Group 24 (Draft Smart Contract Design)

## 🧩 Problem Statement
Modern supply chains involve multiple independent entities such as manufacturers, distributors, and retailers, which leads to **lack of transparency**, **data silos**, and **difficulty verifying product authenticity/compliance**.  
We propose a **blockchain-based provenance system** that records a product’s lifecycle on-chain (registration, transfers, status) and anchors **privacy-preserving cold-chain evidence** using tiny **Merkle root receipts** instead of raw sensor data.

Our smart contract enables on-chain recording of:
- Product creation and registration  
- Ownership/custody transfers and simple lifecycle status  
- **Proof-of-Cold anchors**: per-window Merkle roots and a final **sealed** root for later ZK verification

> For the full contract interface (signatures + detailed comments), see **CONTRACT_INTERFACE.md** in this folder.

---

## 🛠️ Tech Stack and Approach
**Blockchain Platform:** Ethereum  
**Smart Contract Language:** Solidity (v0.8.19)  
**Development Environment:** Remix IDE (Remix VM – Prague)  
**Wallet / Testing Accounts:** Remix simulated accounts (100 ETH each)  
**Version Control:** GitHub (planned)  
**Framework for expansion:** Hardhat + Ethers.js (UI & integration)

### Approach
1. **Smart Contract Design:** Define a `Product` with key attributes (ID, manufacturer/owner, SKU, metadata URI, timestamps, lifecycle status).  
2. **Mappings & Events:** Store products by ID; emit events (`ProductRegistered`, `CustodyTransferred`, `StatusUpdated`, `ProductCertified`, `WindowCommitted`, `ShipmentSealed`) for easy off-chain indexing.  
3. **Roles (lightweight):** `admin` can toggle **regulators** (can `certify`) and **committers** (gateway accounts that can `commitWindowRoot`).  
4. **Proof-of-Cold Anchors:** Instead of sending raw temperatures on-chain, the gateway posts **Merkle roots** per short **window**; at delivery the shipment is **sealed** with a single **root-of-roots**. A later ZK verifier will reference that `sealedRoot(productId)`.

---

## 🏗️ System Overview and Architecture

### System Components
1. **Manufacturer:** Registers new products; may update status; can seal a shipment.  
2. **Distributor / Retailer:** Receives products through `transferCustody`.  
3. **Regulator (optional):** Can `certify` products (admin-approved role).  
4. **Gateway (committer):** Posts per-window Merkle roots while shipping (admin-approved role).  
5. **Consumer / Auditor:** Verifies provenance and reads the sealed anchor on-chain.

### Core Smart Contract Modules (current draft)
| Function | What it does (high level) |
|---|---|
| `registerProduct(string sku, string metadataURI)` → `uint256` | Create a product with caller as manufacturer & initial owner; emits `ProductRegistered`. |
| `getProduct(uint256 id)` | Read all stored fields (tuple) for UIs/Remix. |
| `getAllProductIds()` / `totalProducts()` / `currentOwnerOf(uint256 id)` | Simple listing and quick reads for UIs. |
| `transferCustody(uint256 id, address to, string notes)` | Owner-only transfer; emits `CustodyTransferred`. |
| `updateStatus(uint256 id, Status newStatus, string notes)` | Owner or manufacturer marks `Created/Shipped/Received/Delivered`; emits `StatusUpdated`. |
| `setRegulator(address, bool)` / `certify(uint256 id, string note)` | Admin toggles regulators; regulators can certify. |
| `setCommitter(address, bool)` | Admin approves gateway accounts allowed to post window roots. |
| `commitWindowRoot(uint256 id, uint32 w, bytes32 root)` | Commit next **window Merkle root** (strict order 1,2,3…); emits `WindowCommitted`. |
| `stopAndSeal(uint256 id, bytes32 rootOfRoots)` | Finalize with one **root-of-roots**; blocks further commits; emits `ShipmentSealed`. |
| Views: `windowRoot(id,w)`, `lastCommittedWindow(id)`, `isSealed(id)`, `sealedRoot(id)` | Inspect the Proof-of-Cold timeline and final anchor. |

### Architecture Flow
1. **Register:** Manufacturer calls `registerProduct(...)` → new `productId` created and stored; event emitted.  
2. **Transfer (optional):** Current owner calls `transferCustody(...)` to move the asset; event emitted.  
3. **Status updates (optional):** Owner/manufacturer calls `updateStatus(...)`.  
4. **During shipping:** Admin-approved **gateway (committer)** calls `commitWindowRoot(id, 1..N, root)` as windows close; each emits `WindowCommitted`.  
5. **At delivery:** Owner or manufacturer calls `stopAndSeal(id, rootOfRoots)`; this stores one final anchor (`sealedRoot`) that later ZK proofs will reference.  
6. **Verification (later milestone):** A ZK verifier contract checks a proof “rule broke or not” **against `sealedRoot(id)`**; an escrow contract can auto-settle.

---

## 🔮 Roadmap (next phases)
- Plug in a **ZK circuit + Groth16 verifier** for “time over threshold ≥ Y minutes” using the sealed root.  
- Minimal **web UI** (Ethers.js) to list products, view events, and interact with functions.  
- A tiny **gateway service** (Node.js) to batch readings → build Merkle roots → call `commitWindowRoot`.  
- Optional: richer **IPFS metadata** (include content hash), more granular roles, and testnet deployment (Sepolia).

---

## ⚙️ Implementation Details (what’s done now)

### What Has Been Done
- Solidity contract compiled and tested in **Remix** (0.8.19, Remix VM Prague).  
- Core provenance: `registerProduct`, `getProduct`, `transferCustody`, `updateStatus`.  
- **Roles implemented:** `setRegulator`, `setCommitter`, with checks in `certify`/`commitWindowRoot`.  
- **Proof-of-Cold anchors implemented:** `commitWindowRoot` (ordered windows) and `stopAndSeal` (final root).  
- Helper reads for UIs: `getAllProductIds`, `totalProducts`, `currentOwnerOf`; plus timeline views.

### How To Deploy & Try (Remix, 2–3 minutes)
1. Open **Remix** → create `SupplyChain.sol` → paste the contract.  
2. **Compile** with Solidity **0.8.19**.  
3. **Deploy** via **Deploy & Run** → Environment: **Remix VM (Prague)**.  
4. *(Optional for timeline)* As admin, call `setCommitter(<your current account>, true)`.  
5. **Register**: `registerProduct("SKU-001", "ipfs://example")` → note `productId` in the tx log.  
6. **Read**: `getProduct(<id>)` or list with `getAllProductIds()`.  
7. **Transfer**: ensure **caller = current owner**, then `transferCustody(<id>, <another account>, "Shipped")`.  
8. **Window roots**: `commitWindowRoot(<id>, 1, 0xabc...)`, then `(..., 2, 0xdef...)` (must be in order).  
9. **Seal**: `stopAndSeal(<id>, 0xfeed...beef)` → `isSealed(<id>)` returns true, `sealedRoot(<id>)` shows the anchor.

> All transactions appear as green “Transaction mined” logs. Expand **Decoded logs** to see event details.

---

## ✅ Summary
This draft provides a **working provenance base** with privacy-friendly **Proof-of-Cold anchors** (window roots + sealed root). It is small, readable, and ready to connect to a ZK verifier and a simple web UI in the next milestone.

---

## Team — CSE540: Engineering Blockchain Applications (Fall B 2025)
Harsh Nitinkumar Chandak · Soham Sachin Joshi · Kartik Suhas Marathe · Aman Bhaiji Jain
