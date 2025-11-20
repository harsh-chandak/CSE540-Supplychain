require('dotenv').config();
const { ethers } = require("ethers");
const { buildPoseidon } = require("circomlibjs");

// --- CONFIGURATION ---
const CONTRACT_ADDRESS = process.env.SUPPLY_CHAIN_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL;

// Simplified Interface to talk to the blockchain
const ABI = [
    "function stopAndSeal(uint256 productId, bytes32 rootOfRoots) external",
    "function registerProduct(string sku, string metadataURI) external returns (uint256)",
    "function isSealed(uint256 productId) view returns (bool)"
];

async function main() {
    console.log("🔌 Starting ZK-ColdChain Gateway...");

    if (!PRIVATE_KEY || !CONTRACT_ADDRESS) {
        throw new Error("❌ Missing config! Check your .env file.");
    }

    // 1. Setup Blockchain Connection
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

    console.log(`🔹 Gateway Wallet: ${wallet.address}`);

    // 2. SIMULATE DATA COLLECTION
    // In a real app, these come from physical sensors.
    // We simulate a '10' degree breach here.
    const productId = 3; 
    const readings = [7, 6, 8, 10, 7]; 
    const secretSalt = "12345"; 
    
    console.log(`\n🌡️  Simulating Sensor Data for Product ID ${productId}...`);
    console.log(`   Readings: [${readings}]`);

    // 3. CALCULATE POSEIDON HASH (The "Root")
    // We must match the ZK Circuit's math exactly.
    console.log("⚙️  Calculating Merkle Root off-chain...");
    const poseidon = await buildPoseidon();
    
    // Convert inputs to BigInt strings
    const inputs = [...readings, secretSalt].map(x => BigInt(x).toString());
    
    // Hash inputs
    const hash = poseidon(inputs);
    
    // Convert to Hex string for Solidity
    const hashHex = poseidon.F.toString(hash, 16);
    const finalRoot = "0x" + hashHex.padStart(64, '0'); 

    console.log(`🔐 Generated Root: ${finalRoot}`);

    // 4. AUTOMATED BLOCKCHAIN COMMIT
    console.log("\n🚀 Sending transaction to Sepolia...");
    
    // Check if sealed first to avoid wasting gas
    const isSealed = await contract.isSealed(productId);
    if (isSealed) {
        console.log("⚠️  Product is already sealed! Change 'productId' in gateway.js to test again.");
        return;
    }

    // Send the transaction
    const tx = await contract.stopAndSeal(productId, finalRoot);
    console.log(`⏳ Transaction pending... (Hash: ${tx.hash})`);
    
    await tx.wait();
    console.log("✅ Shipment Sealed Successfully!");
}

main().catch((error) => {
    console.error("\n❌ Error:");
    console.error(error.reason || error.message);
    process.exit(1);
});