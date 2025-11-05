# ZK- ColdChain: Private Compliance Proofs With Parametric Payouts – Group 24 (Draft Smart Contract Design)

## 🧩 Problem Statement
Modern supply chains involve multiple independent entities such as manufacturers, distributors, and retailers.  
This often leads to **lack of transparency**, **data silos**, and **difficulty in verifying product authenticity**.  
To address these challenges, we propose a **blockchain-based provenance system** that ensures **traceability, immutability, and trust** in product lifecycle management.

Our smart contract enables on-chain recording of:
- Product creation and registration
- Ownership/custody transfers
- Event-based tracking for verification and compliance

---

## 🛠️ Tech Stack and Approach
**Blockchain Platform:** Ethereum
**Smart Contract Language:** Solidity (v0.8.19)  
**Development Environment:** Remix IDE (Remix VM – Prague)  
**Wallet / Testing Accounts:** Remix test accounts (simulated 100 ETH each)  
**Version Control:** GitHub Repository  
**Framework for future expansion:** Hardhat + Ethers.js (for UI and integration)

### Approach:
1. **Smart Contract Design:** Define `Product` structure with key attributes (ID, manufacturer, SKU, metadata, timestamps, and current owner).  
2. **Mapping Storage:** Each product is stored using a unique ID (`uint256`) mapped to its struct instance.  
3. **Event Emission:** Every product registration and custody transfer emits an event for easy off-chain indexing.  
4. **Testing Environment:** Used Remix IDE’s built-in EVM (Prague) to deploy and validate functions.  
5. **Future-readiness:** Code structured for easy integration with web3 frontend and role-based access control.

---

## 🏗️ System Overview and Architecture

### System Components
1. **Manufacturer:** Registers new products and assigns metadata (IPFS link or textual URI).  
2. **Distributor / Retailer:** Can receive products through `transferCustody`.  
3. **Consumer / Auditor:** Can verify provenance using `getProduct(productId)`.

### Core Smart Contract Modules
| Function | Description |
|-----------|--------------|
| `registerProduct(address manufacturer, string sku, string metadataURI)` | Registers a new product and emits an event |
| `getProduct(uint256 productId)` | Returns all on-chain details of a product |
| `transferCustody(uint256 productId, address to, string notes)` | Transfers product ownership to another participant |
| Events | `ProductRegistered`, `CustodyTransferred` |

### Architecture Flow
1. **Product Registration:** Manufacturer adds product → new `productId` created and stored.  
2. **Event Logging:** Contract emits `ProductRegistered` event.  
3. **Custody Transfer:** Current owner executes `transferCustody` → ownership updated.  
4. **Product Query:** Any user calls `getProduct(id)` for full traceability.  

> All transactions are immutable, timestamped, and verifiable on-chain.

---

## 🔮 Future Plan
For the next phases (Midterm & Final Deliverables):
- Integrate with **React UI + Ethers.js** for end-user interaction.
- Add **`getAllProductIds()`** to list all registered products.
- Introduce **role-based access control** (manufacturer, distributor, regulator).
- Integrate **IPFS** for storing and linking product certificates.
- Deploy to **Polygon Amoy Testnet** via MetaMask and display live product provenance.
- Add **ZK-proof based verification** for confidential shipments (from proposal).

---

## ⚙️ Implementation Details

### What Has Been Done
- **Smart Contract** written and tested in Solidity using Remix IDE.
- Core functions (`registerProduct`, `getProduct`, `transferCustody`) successfully compiled and executed.
- **Event logging** confirmed for registration and transfers.
- **Validation logic** prevents invalid operations such as duplicate access or missing products.

### How It Works
1. Deploy the `SupplyChain` contract in Remix IDE.
2. Use `registerProduct()` to add a product with:
   - `manufacturer`: your Remix account address (e.g., `0x5B38...eddC4`)
   - `sku`: `"SKU-001"`
   - `metadataURI`: `"ipfs://example"`
3. Verify the new entry using `getProduct(1)`.
4. Optionally test ownership transfer using `transferCustody(1, <new_address>, "Shipped to retailer")`.

---

## 👩‍💻 How an Observer or Evaluator Can Use It

1. **Open Remix IDE** → [https://remix.ethereum.org](https://remix.ethereum.org)
2. **Paste the contract code** from `SupplyChain.sol`
3. **Select Environment:** `Remix VM (Prague)`
4. **Compile** the contract using Solidity version `0.8.19`
5. **Deploy** → `SupplyChain`
6. **Test Functions:**
   - Call `registerProduct()` with valid parameters.
   - Call `getProduct(1)` to retrieve details.
   - Observe event logs under **"Deployed Contracts"** and **Remix Console**.

No external dependencies or real tokens are required, runs entirely in Remix’s simulated blockchain.

---

## ✅ Summary
This draft demonstrates a **working foundation** for a blockchain-powered provenance system.  
It defines the **core logic and structure** for recording and verifying supply chain data, forming the basis for a transparent and tamper-proof logistics tracking system.  
Future iterations will expand this into a fully functional **web application** with real-time blockchain integration and user interface.

---

## Team Group 24 – CSE540: Engineering Blockchain Applications (Fall B 2025)
Harsh Nitinkumar Chandak | Soham Sachin Joshi | Kartik Suhas Marathe | Aman Bhaiji Jain
