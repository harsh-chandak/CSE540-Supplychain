import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// --- 1. CONFIGURATION ---
// PASTE YOUR DEPLOYED ADDRESSES HERE
const INSURANCE_ADDRESS = "0xA3975fFC61c7DD6D85e4D8A76bfad9B4fd98A2E5";
const SUPPLY_CHAIN_ADDRESS = "0x8CeC8a67c76f66Df0A663699D2778B39838Bd4cF";

const INSURANCE_ABI = [
  "function policies(uint256) view returns (address, address, uint256, uint256, bool)",
  "function createPolicy(uint256 productId, address buyer, uint256 durationInSeconds) external payable",
  "function settleClaim(uint256 productId, uint[2] a, uint[2][2] b, uint[2] c, uint[3] input) external"
];
const SUPPLY_CHAIN_ABI = [
  "function registerProduct(string sku, string metadataURI) external returns (uint256)",
  "function stopAndSeal(uint256 productId, bytes32 rootOfRoots) external",
  "function isSealed(uint256 productId) view returns (bool)"
];

export default function App() {
  // State
  const [wallet, setWallet] = useState(null);
  const [address, setAddress] = useState(""); 
  const [status, setStatus] = useState("");
  const [activeTab, setActiveTab] = useState("manufacturer");
  
  // Inputs
  const [productId, setProductId] = useState("1");
  const [sku, setSku] = useState("Vaccine-Batch-Final");
  const [policyData, setPolicyData] = useState(null);
  const [readings, setReadings] = useState("7, 6, 8, 10, 7"); 

  // --- HELPER: Browser ZK Prover ---
  async function generateProof() {
    setStatus("⏳ Generating ZK Proof in Browser...");
    const snarkjs = await import('snarkjs');
    const input = {
      readings: readings.split(",").map(x => parseInt(x.trim())),
      secretSalt: "12345",
      maxTemp: 8
    };
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input, "/temperature.wasm", "/circuit_final.zkey"
    );
    return { proof, publicSignals };
  }

  // --- WALLET CONNECTION ---
  async function connectWallet() {
    if (!window.ethereum) return alert("Install MetaMask!");
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum, "any");
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      const addr = await signer.getAddress();
      setWallet(signer);
      setAddress(addr);
      setStatus("✅ Connected: " + addr.substring(0,6) + "...");
    } catch (err) { setStatus(err.message); }
  }

  // --- ACTIONS ---
  async function registerProduct() {
      if (!wallet) return;
      try {
        // 1. Force Network Check BEFORE transaction
        const { chainId } = await wallet.provider.getNetwork();
        if (chainId !== 11155111) {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }], // Sepolia Hex ID
          });
          // Re-connect wallet to update the signer
          const provider = new ethers.providers.Web3Provider(window.ethereum, "any");
          await provider.send("eth_requestAccounts", []);
          setWallet(provider.getSigner());
          throw new Error("Network switched! Please click Register again.");
        }

        // 2. Send Transaction
        setStatus("Registering... Check MetaMask for 'Review Alert'");
        const contract = new ethers.Contract(SUPPLY_CHAIN_ADDRESS, SUPPLY_CHAIN_ABI, wallet);
        const tx = await contract.registerProduct(sku, "http://ipfs.io");
        await tx.wait();
        setStatus("✅ Registered! Product ID: " + productId);
      } catch (err) { setStatus("Error: " + (err.reason || err.message)); }
  }

  async function buyInsurance() {
    if (!wallet) return;
    try {
      setStatus("Paying Deposit... Check MetaMask");
      const contract = new ethers.Contract(INSURANCE_ADDRESS, INSURANCE_ABI, wallet);
      const tx = await contract.createPolicy(productId, address, 3600, { 
        value: ethers.utils.parseUnits("1", "finney") 
      });
      await tx.wait();
      setStatus("✅ Policy Created!");
    } catch (err) { setStatus("Error: " + (err.reason || err.message)); }
  }

  async function sealShipment() {
    if (!wallet) return;
    try {
      const { publicSignals } = await generateProof();
      const root = BigInt(publicSignals[0]).toString(16);
      const hexRoot = "0x" + root.padStart(64, '0');
      setStatus("🔐 Root Calculated. Sealing on Chain...");
      const contract = new ethers.Contract(SUPPLY_CHAIN_ADDRESS, SUPPLY_CHAIN_ABI, wallet);
      const tx = await contract.stopAndSeal(productId, hexRoot);
      await tx.wait();
      setStatus("✅ Shipment Sealed on Chain!");
    } catch (err) { setStatus("Error: " + (err.reason || err.message)); }
  }

  async function checkPolicy() {
    if (!wallet) return;
    try {
      const contract = new ethers.Contract(INSURANCE_ADDRESS, INSURANCE_ABI, wallet);
      const data = await contract.policies(productId);
      setPolicyData({
        deposit: ethers.utils.formatEther(data[2]),
        isResolved: data[4].toString()
      });
    } catch (err) { setStatus("Error loading policy."); }
  }

  async function claimPayout() {
    if (!wallet) return;
    try {
      const { proof, publicSignals } = await generateProof();
      const a = [proof.pi_a[0], proof.pi_a[1]];
      const b = [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]];
      const c = [proof.pi_c[0], proof.pi_c[1]];
      const input = publicSignals;
      setStatus("🛡️ Proof Generated. Submitting Claim...");
      const contract = new ethers.Contract(INSURANCE_ADDRESS, INSURANCE_ABI, wallet);
      const tx = await contract.settleClaim(productId, a, b, c, input);
      await tx.wait();
      setStatus("💰 Payout Successful!");
      checkPolicy(); 
    } catch (err) { setStatus("Error: " + (err.reason || err.message)); }
  }

  // --- STYLES ---
  const styles = {
    container: { fontFamily: "'Inter', sans-serif", maxWidth: "800px", margin: "0 auto", padding: "20px", backgroundColor: "#121212", color: "#ffffff", minHeight: "100vh" },
    header: { textAlign: "center", color: "#61dafb", marginBottom: "30px" },
    statusBar: { background: "#1e1e1e", padding: "15px", borderRadius: "8px", border: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
    btnConnect: { background: "#61dafb", color: "#000", border: "none", padding: "10px 20px", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" },
    tabContainer: { display: "flex", marginBottom: "20px", borderBottom: "1px solid #333" },
    tab: (isActive) => ({ flex: 1, padding: "15px", cursor: "pointer", background: isActive ? "#1e1e1e" : "transparent", color: isActive ? "#61dafb" : "#888", border: "none", borderBottom: isActive ? "2px solid #61dafb" : "none", fontWeight: "bold", transition: "all 0.2s" }),
    card: { background: "#1e1e1e", padding: "25px", borderRadius: "12px", border: "1px solid #333", boxShadow: "0 4px 6px rgba(0,0,0,0.3)" },
    input: { padding: "12px", background: "#2c2c2c", border: "1px solid #444", color: "#fff", borderRadius: "5px", width: "100%", marginBottom: "15px", marginTop: "5px" },
    btnAction: { width: "100%", padding: "12px", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "16px", fontWeight: "bold", color: "#fff", marginTop: "10px" }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>❄️ ZK-ColdChain Final Demo</h1>
      
      <div style={styles.statusBar}>
        <div>
            <strong style={{color: "#888"}}>Status:</strong> <span style={{color: "#4cd137"}}>{status}</span> <br/>
            <small style={{color: "#666"}}>Wallet: {address || "Not Connected"}</small>
        </div>
        <button onClick={connectWallet} style={styles.btnConnect}>{wallet ? "Connected" : "Connect Wallet"}</button>
      </div>

      <div style={styles.tabContainer}>
        {['manufacturer', 'shipper', 'gateway', 'buyer'].map(role => (
          <button key={role} onClick={() => setActiveTab(role)} style={styles.tab(activeTab === role)}>
            {role.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={styles.card}>
        <div style={{marginBottom: "20px"}}>
             <label style={{color: "#aaa"}}>Target Product ID:</label>
             <input value={productId} onChange={e => setProductId(e.target.value)} style={{...styles.input, width: "100px", marginLeft: "10px"}}/>
        </div>

        {activeTab === 'manufacturer' && (
            <div>
                <h3>Step 1: Register Product</h3>
                <label>SKU Name</label>
                <input value={sku} onChange={e => setSku(e.target.value)} style={styles.input} />
                <button onClick={registerProduct} style={{...styles.btnAction, background: "#2ecc71"}}>Register to Blockchain</button>
            </div>
        )}

        {activeTab === 'shipper' && (
            <div>
                <h3>Step 2: Buy Insurance</h3>
                <p style={{color: "#aaa"}}>Depositing 0.001 ETH collateral.</p>
                <button onClick={buyInsurance} style={{...styles.btnAction, background: "#f1c40f", color: "#000"}}>Pay Deposit</button>
            </div>
        )}

        {activeTab === 'gateway' && (
            <div>
                <h3>Step 3: IoT Gateway Simulation</h3>
                <label>Simulated Sensor Readings (CSV)</label>
                <input value={readings} onChange={e => setReadings(e.target.value)} style={styles.input} />
                <button onClick={sealShipment} style={{...styles.btnAction, background: "#9b59b6"}}>Calculate ZK Root & Seal</button>
            </div>
        )}

        {activeTab === 'buyer' && (
            <div>
                <h3>Step 4: Verify & Claim</h3>
                <button onClick={checkPolicy} style={{...styles.btnAction, background: "#34495e", marginBottom: "20px"}}>Check Current Status</button>
                {policyData && (
                    <div style={{background: "#2c2c2c", padding: "15px", borderRadius: "5px", marginBottom: "20px"}}>
                        <p>💰 <strong>Locked Deposit:</strong> {policyData.deposit} ETH</p>
                        <p>⚖️ <strong>Resolved:</strong> {policyData.isResolved}</p>
                    </div>
                )}
                <button onClick={claimPayout} style={{...styles.btnAction, background: "#e74c3c"}}>Generate Proof & Claim Payout</button>
            </div>
        )}
      </div>
    </div>
  );
}