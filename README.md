# SupplyChain Provenance – Group 24

## Project Overview
This repository contains our draft smart contract design for a blockchain-based supply-chain provenance system.  
The goal is to make product history and ownership traceable across manufacturers, distributors, and retailers using smart contracts on Ethereum.

This submission represents our **Draft Smart Contract Design** stage. It includes a Solidity contract with high-level comments, function signatures, and supporting test and deployment scripts.

## What the Project Does
The contract allows participants to:
- Register new product batches with identifying metadata
- Transfer custody of a product to another address
- Query basic product details and current ownership
- Emit events for off-chain indexing or zero-knowledge commitments

The system aims to improve transparency, authenticity, and trust across the supply chain.

## Folder Structure
```
contracts/ → Solidity contracts (core logic)
test/ → Unit tests written in JavaScript (Hardhat + ethers)
scripts/ → Deployment and setup scripts
CONTRACT_DRAFT.md → Human-readable explanation of contract functions and events
hardhat.config.js → Hardhat configuration
package.json → Node dependencies and npm scripts
```

## Dependencies and Setup
To build and test this project you’ll need:
- Node.js LTS and npm (installed via nvm or Homebrew)
- Hardhat (installed automatically by npm)
- Git for version control
- VS Code or any text editor with Solidity support

### Installation Steps
Open a terminal and run:
```
npm install
```
This installs all required packages including Hardhat, Ethers, OpenZeppelin Contracts, Chai, and Mocha.

---

### How to Run the Project
1. Compile the Contract
```
npx hardhat compile
```

2. Run Tests
Run the automated test suite to ensure everything compiles and basic flows work:
```
npx hardhat test
```

3. Start a Local Blockchain
Run a local Ethereum node using Hardhat:
```
npx hardhat node
```

4. Deploy the Contract Locally
In a new terminal window:
```
npx hardhat run scripts/deploy.js --network localhost
```
This command deploys the draft contract to your local Hardhat network and displays the deployed address.

---

### How to Use the Contract

Once the contract is deployed, you can interact with it directly from the Hardhat console:
```
npx hardhat console --network localhost
```

Then inside the console:

```const SupplyChain = await ethers.getContractFactory("SupplyChain");
const sc = await SupplyChain.attach("<deployed_address>");
await sc.registerProduct("<manufacturer_address>", "SKU-001", "ipfs://...");
const product = await sc.getProduct(1);
console.log(product);
```

### Notes for Reviewers

This version focuses on:

- Designing the main smart contract structure

- Defining core functions, events, and responsibilities

- Providing working local tests and deployment scripts

- Advanced access control, detailed custody history, and zero-knowledge proof integration will be implemented in later project phases.
