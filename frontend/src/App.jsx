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
  const [isNarrow, setIsNarrow] = useState(false);

  // Inputs
  const [productId, setProductId] = useState("1");
  const [sku, setSku] = useState("Vaccine-Batch-Final");
  const [policyData, setPolicyData] = useState(null);
  const [readings, setReadings] = useState("7, 6, 8, 10, 7");

  // Responsive layout: track viewport width for nicer stacking on smaller screens
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined") {
        setIsNarrow(window.innerWidth < 1024);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
      input,
      "/temperature.wasm",
      "/circuit_final.zkey"
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
      setStatus("✅ Connected: " + addr.substring(0, 6) + "...");
    } catch (err) {
      setStatus(err.message);
    }
  }

  // --- ACTIONS (UNCHANGED FUNCTIONALITY) ---
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
    } catch (err) {
      setStatus("Error: " + (err.reason || err.message));
    }
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
    } catch (err) {
      setStatus("Error: " + (err.reason || err.message));
    }
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
    } catch (err) {
      setStatus("Error: " + (err.reason || err.message));
    }
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
    } catch (err) {
      setStatus("Error loading policy.");
    }
  }

  async function claimPayout() {
    if (!wallet) return;
    try {
      const { proof, publicSignals } = await generateProof();
      const a = [proof.pi_a[0], proof.pi_a[1]];
      const b = [
        [proof.pi_b[0][1], proof.pi_b[0][0]],
        [proof.pi_b[1][1], proof.pi_b[1][0]]
      ];
      const c = [proof.pi_c[0], proof.pi_c[1]];
      const input = publicSignals;
      setStatus("🛡️ Proof Generated. Submitting Claim...");
      const contract = new ethers.Contract(INSURANCE_ADDRESS, INSURANCE_ABI, wallet);
      const tx = await contract.settleClaim(productId, a, b, c, input);
      await tx.wait();
      setStatus("💰 Payout Successful!");
      checkPolicy();
    } catch (err) {
      setStatus("Error: " + (err.reason || err.message));
    }
  }

  // --- UI METADATA (for nicer layout only) ---
  const steps = [
    {
      id: "manufacturer",
      label: "Manufacturer",
      icon: "🏭",
      title: "Register Product",
      description: "Mint a new cold-chain item on-chain with its SKU and metadata."
    },
    {
      id: "shipper",
      label: "Shipper",
      icon: "🚚",
      title: "Lock Insurance",
      description: "Lock collateral for the shipment before it leaves the facility."
    },
    {
      id: "gateway",
      label: "Gateway",
      icon: "📡",
      title: "Seal with ZK Proof",
      description: "Simulate IoT sensor readings and seal the shipment with a zk-SNARK root."
    },
    {
      id: "buyer",
      label: "Buyer",
      icon: "🧪",
      title: "Verify & Claim",
      description: "Verify shipment integrity and claim payout if the conditions were violated."
    }
  ];

  const activeStep = steps.find(s => s.id === activeTab) || steps[0];
  const formattedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "Not connected";

  // --- STYLES (UI ONLY) ---
  const styles = {
    container: {
      fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      width: "100vw",               // fill entire viewport width
      minHeight: "100vh",
      padding: "24px clamp(16px, 3vw, 36px) 40px",
      boxSizing: "border-box",
      background:
        "radial-gradient(circle at 0% 0%, #0f172a 0, #020617 55%, #000000 100%)",
      color: "#e5e7eb",
      position: "relative",
      overflowX: "hidden",
      overflowY: "auto"
    },
    glow: {
      position: "absolute",
      top: "-180px",
      right: "-120px",
      width: "520px",
      height: "520px",
      background:
        "radial-gradient(circle at center, rgba(56,189,248,0.25), transparent 60%)",
      opacity: 0.8,
      pointerEvents: "none",
      filter: "blur(4px)"
    },
    glowLeft: {
      position: "absolute",
      bottom: "-220px",
      left: "-120px",
      width: "480px",
      height: "480px",
      background:
        "radial-gradient(circle at center, rgba(52,211,153,0.26), transparent 60%)",
      opacity: 0.8,
      pointerEvents: "none",
      filter: "blur(4px)"
    },
    appShell: {
      position: "relative",
      zIndex: 1,
      width: "100%",
      maxWidth: "1320px",  // a bit wider than before
      margin: "0 auto"
    },
    header: {
      display: "flex",
      flexDirection: isNarrow ? "column" : "row",
      alignItems: isNarrow ? "flex-start" : "center",
      justifyContent: "space-between",
      gap: "24px"
    },
    titleBlock: {
      flex: 1
    },
    title: {
      fontSize: isNarrow ? "24px" : "28px",
      fontWeight: 700,
      letterSpacing: "0.03em",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      marginBottom: "6px"
    },
    badge: {
      padding: "4px 10px",
      borderRadius: "999px",
      border: "1px solid rgba(148, 163, 184, 0.4)",
      fontSize: "11px",
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      color: "#a5b4fc",
      background:
        "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,64,175,0.5))"
    },
    subtitle: {
      fontSize: "14px",
      color: "#9ca3af",
      maxWidth: "620px",
      lineHeight: 1.5
    },
    headerRight: {
      display: "flex",
      flexDirection: "column",
      alignItems: isNarrow ? "flex-start" : "flex-end",
      gap: "10px"
    },
    walletPill: {
      padding: "10px 14px",
      borderRadius: "999px",
      border: "1px solid rgba(148,163,184,0.4)",
      background: "rgba(15,23,42,0.85)",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      fontSize: "12px"
    },
    walletDot: (connected) => ({
      width: "9px",
      height: "9px",
      borderRadius: "999px",
      background: connected ? "#22c55e" : "#6b7280",
      boxShadow: connected ? "0 0 12px rgba(34,197,94,0.8)" : "none"
    }),
    walletText: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: "2px"
    },
    walletLabel: {
      fontSize: "11px",
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      color: "#6b7280"
    },
    walletValue: {
      fontSize: "12px",
      color: "#e5e7eb"
    },
    networkTag: {
      fontSize: "11px",
      padding: "4px 8px",
      borderRadius: "999px",
      background: "rgba(15,118,110,0.18)",
      color: "#5eead4",
      border: "1px solid rgba(45,212,191,0.45)"
    },
    btnConnect: {
      background:
        "linear-gradient(135deg, #22c55e, #10b981, #06b6d4)",
      color: "#020617",
      border: "none",
      padding: "9px 18px",
      borderRadius: "999px",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: "13px",
      boxShadow: "0 12px 25px rgba(16,185,129,0.35)",
      transition: "transform 0.15s ease, box-shadow 0.15s ease",
      whiteSpace: "nowrap"
    },
    mainLayoutBase: {
      marginTop: "28px",
      display: "grid",
      gap: "24px",
      alignItems: "flex-start"
    },
    leftColumnCard: {
      background:
        "linear-gradient(145deg, rgba(15,23,42,0.98), rgba(15,23,42,0.92))",
      borderRadius: "24px",
      padding: "22px 22px 24px",
      border: "1px solid rgba(148,163,184,0.35)",
      boxShadow:
        "0 18px 45px rgba(15,23,42,0.95), 0 0 0 1px rgba(15,23,42,0.9)",
      backdropFilter: "blur(20px)"
    },
    rightColumnCard: {
      background:
        "linear-gradient(160deg, rgba(15,23,42,0.97), rgba(30,64,175,0.35))",
      borderRadius: "24px",
      padding: "18px 18px 20px",
      border: "1px solid rgba(129,140,248,0.45)",
      boxShadow: "0 18px 40px rgba(30,64,175,0.65)",
      backdropFilter: "blur(22px)",
      minHeight: "220px"
    },
    cardHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "16px",
      gap: "10px"
    },
    cardTitle: {
      fontSize: "14px",
      textTransform: "uppercase",
      letterSpacing: "0.16em",
      color: "#9ca3af"
    },
    cardAccent: {
      fontSize: "11px",
      padding: "4px 9px",
      borderRadius: "999px",
      background: "rgba(37,99,235,0.12)",
      border: "1px solid rgba(59,130,246,0.45)",
      color: "#bfdbfe"
    },
    tabsRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      padding: "5px",
      background: "rgba(15,23,42,0.95)",
      borderRadius: "999px",
      border: "1px solid rgba(55,65,81,0.9)",
      marginBottom: "18px"
    },
    tabButton: (isActive) => ({
      flex: 1,
      minWidth: "110px",
      padding: "8px 10px",
      borderRadius: "999px",
      border: "none",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
      fontSize: "12px",
      fontWeight: isActive ? 600 : 500,
      color: isActive ? "#e5e7eb" : "#9ca3af",
      background: isActive
        ? "linear-gradient(135deg, #2563eb, #22d3ee)"
        : "transparent",
      boxShadow: isActive ? "0 10px 18px rgba(37,99,235,0.55)" : "none",
      transition: "all 0.18s ease"
    }),
    tabIcon: {
      fontSize: "13px"
    },
    smallLabel: {
      fontSize: "11px",
      textTransform: "uppercase",
      letterSpacing: "0.14em",
      color: "#6b7280",
      marginBottom: "4px"
    },
    idRow: {
      display: "flex",
      flexDirection: isNarrow ? "column" : "row",
      alignItems: isNarrow ? "flex-start" : "flex-end",
      gap: "16px",
      marginBottom: "20px"
    },
    idInputWrapper: {
      display: "flex",
      flexDirection: "column",
      gap: "6px"
    },
    idInput: {
      padding: "10px 12px",
      background: "rgba(15,23,42,0.85)",
      borderRadius: "10px",
      border: "1px solid rgba(55,65,81,0.8)",
      color: "#e5e7eb",
      width: "120px",
      fontSize: "13px"
    },
    pillTag: {
      fontSize: "11px",
      padding: "6px 10px",
      borderRadius: "999px",
      background: "rgba(15,23,42,0.9)",
      border: "1px dashed rgba(75,85,99,0.9)",
      color: "#9ca3af",
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      marginTop: "18px"
    },
    stepHeading: {
      fontSize: "18px",
      fontWeight: 600,
      marginBottom: "4px"
    },
    stepDescription: {
      fontSize: "13px",
      color: "#9ca3af",
      marginBottom: "16px",
      lineHeight: 1.6
    },
    fieldLabel: {
      fontSize: "12px",
      color: "#9ca3af",
      marginBottom: "4px"
    },
    input: {
      padding: "11px 12px",
      background: "rgba(15,23,42,0.9)",
      borderRadius: "10px",
      border: "1px solid rgba(75,85,99,0.95)",
      color: "#e5e7eb",
      width: "100%",
      fontSize: "13px",
      marginBottom: "8px"
    },
    helperText: {
      fontSize: "11px",
      color: "#6b7280",
      marginTop: "4px",
      marginBottom: "4px"
    },
    btnAction: {
      width: "100%",
      padding: "11px 14px",
      borderRadius: "999px",
      border: "none",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: 600,
      color: "#f9fafb",
      marginTop: "10px",
      boxShadow: "0 12px 24px rgba(15,23,42,0.9)",
      transition: "transform 0.15s ease, box-shadow 0.15s ease, opacity 0.1s",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px"
    },
    btnAccentGreen: {
      background: "linear-gradient(135deg, #22c55e, #16a34a)"
    },
    btnAccentYellow: {
      background: "linear-gradient(135deg, #facc15, #f59e0b)",
      color: "#111827"
    },
    btnAccentPurple: {
      background: "linear-gradient(135deg, #a855f7, #6366f1)"
    },
    btnAccentRed: {
      background: "linear-gradient(135deg, #f97373, #ef4444)"
    },
    statusBody: {
      fontSize: "13px",
      color: "#e5e7eb",
      padding: "12px 12px 10px",
      borderRadius: "14px",
      background: "rgba(15,23,42,0.9)",
      border: "1px solid rgba(148,163,184,0.4)",
      minHeight: "64px"
    },
    statusLabelRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "6px"
    },
    statusLabel: {
      fontSize: "11px",
      textTransform: "uppercase",
      letterSpacing: "0.14em",
      color: "#9ca3af"
    },
    statusHint: {
      fontSize: "11px",
      color: "#6b7280"
    },
    statusValue: {
      fontSize: "13px",
      color: "#a5b4fc",
      marginTop: "4px",
      wordBreak: "break-word"
    },
    ledgerDivider: {
      height: "1px",
      background:
        "linear-gradient(to right, transparent, rgba(148,163,184,0.6), transparent)",
      margin: "14px 0"
    },
    ledgerTitleRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    },
    miniTag: {
      fontSize: "10px",
      padding: "3px 7px",
      borderRadius: "999px",
      border: "1px solid rgba(148,163,184,0.5)",
      color: "#9ca3af",
      background: "rgba(15,23,42,0.9)"
    },
    bulletList: {
      listStyle: "none",
      padding: 0,
      margin: 0,
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      fontSize: "12px"
    },
    bulletItem: (isActive) => ({
      padding: "7px 9px",
      borderRadius: "12px",
      background: isActive
        ? "rgba(37,99,235,0.2)"
        : "rgba(15,23,42,0.7)",
      border: isActive
        ? "1px solid rgba(59,130,246,0.8)"
        : "1px solid rgba(31,41,55,0.9)",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      color: isActive ? "#e5e7eb" : "#9ca3af"
    }),
    bulletDot: (isActive) => ({
      width: "8px",
      height: "8px",
      borderRadius: "999px",
      background: isActive ? "#38bdf8" : "#4b5563",
      boxShadow: isActive ? "0 0 10px rgba(56,189,248,0.9)" : "none"
    }),
    bulletTextMain: {
      fontSize: "12px"
    },
    bulletTextSub: {
      fontSize: "11px",
      color: "#6b7280"
    },
    policyCard: {
      background: "rgba(15,23,42,0.9)",
      borderRadius: "12px",
      padding: "10px 12px",
      border: "1px dashed rgba(148,163,184,0.6)",
      fontSize: "12px",
      color: "#e5e7eb",
      marginTop: "10px",
      marginBottom: "6px"
    },
    footer: {
      marginTop: "24px",
      fontSize: "11px",
      color: "#6b7280",
      textAlign: "right"
    }
  };

  const mainLayoutStyle = {
    ...styles.mainLayoutBase,
    gridTemplateColumns: isNarrow
      ? "minmax(0, 1fr)"
      : "minmax(0, 1.75fr) minmax(0, 1.1fr)"
  };

  return (
    <div style={styles.container}>
      {/* subtle glows in corners */}
      <div style={styles.glow} />
      <div style={styles.glowLeft} />

      <div style={styles.appShell}>
        {/* Top Header */}
        <header style={styles.header}>
          <div style={styles.titleBlock}>
            <div style={styles.badge}>Zero-Knowledge Cold-Chain • Sepolia Demo</div>
            <div style={styles.title}>
              <span>❄️ ZK-ColdChain Control Room</span>
            </div>
            <p style={styles.subtitle}>
              Orchestrate the full vaccine cold-chain lifecycle — from on-chain
              registration to IoT-backed insurance — using browser-generated
              zk-SNARK proofs.
            </p>
          </div>

          <div style={styles.headerRight}>
            <div style={styles.walletPill}>
              <div style={styles.walletDot(!!wallet)} />
              <div style={styles.walletText}>
                <span style={styles.walletLabel}>Wallet</span>
                <span style={styles.walletValue}>{formattedAddress}</span>
              </div>
              <span style={styles.networkTag}>Network: Sepolia</span>
            </div>
            <button
              onClick={connectWallet}
              style={styles.btnConnect}
            >
              {wallet ? "Wallet Connected" : "Connect MetaMask"}
            </button>
          </div>
        </header>

        {/* Main Layout */}
        <div style={mainLayoutStyle}>
          {/* LEFT: Role Console */}
          <section style={styles.leftColumnCard}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>Role Console</span>
              <span style={styles.cardAccent}>
                Step {steps.findIndex(s => s.id === activeTab) + 1} of 4
              </span>
            </div>

            {/* Role Tabs */}
            <div style={styles.tabsRow}>
              {steps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => setActiveTab(step.id)}
                  style={styles.tabButton(activeTab === step.id)}
                >
                  <span style={styles.tabIcon}>{step.icon}</span>
                  <span>{step.label}</span>
                </button>
              ))}
            </div>

            {/* Product ID row */}
            <div style={styles.idRow}>
              <div style={styles.idInputWrapper}>
                <span style={styles.smallLabel}>Target Product ID</span>
                <input
                  value={productId}
                  onChange={e => setProductId(e.target.value)}
                  style={styles.idInput}
                />
              </div>
              <div>
                <div style={styles.smallLabel}>Lifecycle Status</div>
                <div style={styles.pillTag}>
                  <span>●</span>
                  <span>
                    {activeTab === "manufacturer"
                      ? "Not yet shipped"
                      : activeTab === "shipper"
                      ? "In transit"
                      : activeTab === "gateway"
                      ? "Sealing & verifying"
                      : "Ready for settlement"}
                  </span>
                </div>
              </div>
            </div>

            {/* Active Step Content */}
            <h3 style={styles.stepHeading}>
              {activeStep.icon} {activeStep.title}
            </h3>
            <p style={styles.stepDescription}>{activeStep.description}</p>

            {activeTab === "manufacturer" && (
              <div>
                <div>
                  <div style={styles.fieldLabel}>SKU Name / Batch Identifier</div>
                  <input
                    value={sku}
                    onChange={e => setSku(e.target.value)}
                    style={styles.input}
                  />
                  <div style={styles.helperText}>
                    This gets anchored on-chain and linked to your off-chain metadata
                    (e.g., IPFS JSON, GS1 identifiers).
                  </div>
                </div>
                <button
                  onClick={registerProduct}
                  style={{ ...styles.btnAction, ...styles.btnAccentGreen }}
                >
                  <span>Register Product to Blockchain</span>
                </button>
              </div>
            )}

            {activeTab === "shipper" && (
              <div>
                <p style={styles.helperText}>
                  A refundable deposit of <strong>0.001 ETH</strong> is locked as
                  collateral for this shipment&apos;s insurance policy.
                </p>
                <button
                  onClick={buyInsurance}
                  style={{ ...styles.btnAction, ...styles.btnAccentYellow }}
                >
                  <span>Pay Deposit & Create Policy</span>
                </button>
              </div>
            )}

            {activeTab === "gateway" && (
              <div>
                <div>
                  <div style={styles.fieldLabel}>Simulated Sensor Readings (CSV)</div>
                  <input
                    value={readings}
                    onChange={e => setReadings(e.target.value)}
                    style={styles.input}
                  />
                  <div style={styles.helperText}>
                    Provide a series of temperature readings (°C). A zero-knowledge
                    circuit proves that <strong>all</strong> values stayed below
                    the allowed threshold.
                  </div>
                </div>
                <button
                  onClick={sealShipment}
                  style={{ ...styles.btnAction, ...styles.btnAccentPurple }}
                >
                  <span>Generate ZK Root & Seal Shipment</span>
                </button>
              </div>
            )}

            {activeTab === "buyer" && (
              <div>
                <button
                  onClick={checkPolicy}
                  style={{
                    ...styles.btnAction,
                    ...styles.btnAccentPurple,
                    marginBottom: "10px",
                    background:
                      "linear-gradient(135deg, #1f2937, #4b5563, #6366f1)"
                  }}
                >
                  <span>Refresh Policy State</span>
                </button>

                {policyData && (
                  <div style={styles.policyCard}>
                    <div>
                      💰 <strong>Locked Deposit:</strong> {policyData.deposit} ETH
                    </div>
                    <div style={{ marginTop: "4px" }}>
                      ⚖️ <strong>Resolved:</strong> {policyData.isResolved}
                    </div>
                  </div>
                )}

                <div style={styles.helperText}>
                  If the ZK proof shows that the cold-chain was violated, the payout
                  will be released to the buyer from the locked deposit.
                </div>

                <button
                  onClick={claimPayout}
                  style={{ ...styles.btnAction, ...styles.btnAccentRed }}
                >
                  <span>Generate Proof & Claim Payout</span>
                </button>
              </div>
            )}
          </section>

          {/* RIGHT: Live Status / Journey */}
          <aside style={styles.rightColumnCard}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>Live Blockchain Panel</span>
              <span style={styles.cardAccent}>Session Overview</span>
            </div>

            {/* Status bubble */}
            <div style={styles.statusBody}>
              <div style={styles.statusLabelRow}>
                <span style={styles.statusLabel}>Current Status</span>
                <span style={styles.statusHint}>
                  {wallet ? "Waiting for your next interaction" : "Connect wallet to begin"}
                </span>
              </div>
              <div style={styles.statusValue}>
                {status || "Idle — no transactions yet in this session."}
              </div>
            </div>

            <div style={styles.ledgerDivider} />

            <div style={styles.ledgerTitleRow}>
              <span style={styles.statusLabel}>Shipment Journey</span>
              <span style={styles.miniTag}>Product #{productId || "—"}</span>
            </div>

            <ul style={{ ...styles.bulletList, marginTop: "10px" }}>
              {steps.map((step, index) => {
                const isActive = step.id === activeTab;
                return (
                  <li key={step.id} style={styles.bulletItem(isActive)}>
                    <div style={styles.bulletDot(isActive)} />
                    <div>
                      <div style={styles.bulletTextMain}>
                        {index + 1}. {step.icon} {step.title}
                      </div>
                      <div style={styles.bulletTextSub}>{step.description}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>

        <div style={styles.footer}>
          Built for demo purposes — not production financial advice or guarantees.
        </div>
      </div>
    </div>
  );
}
