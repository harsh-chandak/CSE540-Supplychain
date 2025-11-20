import React, { useState } from 'react';
import { ethers } from 'ethers';

// --- CONFIGURATION ---
// REPLACE THIS ADDRESS WITH YOUR DEPLOYED INSURANCE CONTRACT ADDRESS
const INSURANCE_CONTRACT_ADDRESS = '0x26Fb63C3B7634f959b8b5266E2F2F16017144b42';

const INSURANCE_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'productId', type: 'uint256' }],
    name: 'policies',
    outputs: [
      { internalType: 'address', name: 'shipper', type: 'address' },
      { internalType: 'address', name: 'buyer', type: 'address' },
      { internalType: 'uint256', name: 'depositAmount', type: 'uint256' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      { internalType: 'bool', name: 'isResolved', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'productId', type: 'uint256' },
      { internalType: 'uint256[2]', name: 'a', type: 'uint256[2]' },
      { internalType: 'uint256[2][2]', name: 'b', type: 'uint256[2][2]' },
      { internalType: 'uint256[2]', name: 'c', type: 'uint256[2]' },
      { internalType: 'uint256[3]', name: 'input', type: 'uint256[3]' },
    ],
    name: 'settleClaim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'productId', type: 'uint256' },
      { internalType: 'address', name: 'buyer', type: 'address' },
      { internalType: 'uint256', name: 'durationInSeconds', type: 'uint256' },
    ],
    name: 'createPolicy',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
];

export default function App() {
  const [wallet, setWallet] = useState(null);
  const [productId, setProductId] = useState('2');
  const [policyData, setPolicyData] = useState(null);
  const [status, setStatus] = useState('');
  const [proofInput, setProofInput] = useState('');

  async function connectWallet() {
    if (window.ethereum) {
      try {
        // 1. Force MetaMask to switch to Sepolia Network (Chain ID: 0xaa36a7)
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }],
          });
        } catch (switchError) {
          // This error code means that the chain has not been added to MetaMask.
          if (switchError.code === 4902) {
            alert('Please add Sepolia network to MetaMask!');
          }
          console.error(switchError);
        }

        // 2. Connect standard provider
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send('eth_requestAccounts', []);

        // 3. Get the signer (account)
        const signer = provider.getSigner();
        setWallet(signer);

        // 4. Verify Network immediately
        const network = await provider.getNetwork();
        if (network.chainId !== 11155111) {
          setStatus('Wrong Network! Refresh page.');
        } else {
          setStatus('Connected to Sepolia!');
        }
      } catch (error) {
        setStatus('Connection failed: ' + error.message);
      }
    } else {
      alert('Please install MetaMask!');
    }
  }

  async function checkPolicy() {
    if (!wallet) {
      setStatus('Connect wallet first.');
      return;
    }
    try {
      setStatus('Checking contract...');

      // --- GHOSTBUSTER TEST START ---
      // 1. Check which network we are actually connected to
      const network = await wallet.provider.getNetwork();
      console.log('Current Network:', network);

      // 2. Check if there is actually code at the address
      const code = await wallet.provider.getCode(INSURANCE_CONTRACT_ADDRESS);
      console.log('Contract Code:', code);

      if (code === '0x') {
        throw new Error(
          'NO CONTRACT FOUND! Are you on Sepolia? Check MetaMask.'
        );
      }
      // --- GHOSTBUSTER TEST END ---

      const contract = new ethers.Contract(
        INSURANCE_CONTRACT_ADDRESS,
        INSURANCE_ABI,
        wallet
      );

      setStatus('Loading from Sepolia...');
      const policy = await contract.policies(productId);
      console.log('Raw Policy Data:', policy);

      setPolicyData({
        deposit: ethers.utils.formatEther(policy[2]) + ' ETH',
        buyer: policy[1],
        isResolved: policy[4].toString(),
      });
      setStatus('Data loaded.');
    } catch (error) {
      setStatus('Error: ' + (error.message || error));
      console.error('FULL ERROR:', error);
    }
  }

  async function claimPayout() {
    if (!wallet) return;
    try {
      setStatus('Processing Proof...');
      const contract = new ethers.Contract(
        INSURANCE_CONTRACT_ADDRESS,
        INSURANCE_ABI,
        wallet
      );

      let proof;
      try {
        proof = JSON.parse(proofInput);
      } catch (e) {
        throw new Error('Invalid JSON. Check your quotes and brackets.');
      }

      if (!proof.a || !proof.b || !proof.c || !proof.input) {
        throw new Error('Invalid Proof Format. Needs a, b, c, and input.');
      }

      setStatus('Please Confirm Transaction in MetaMask...');

      // The smart contract call
      const tx = await contract.settleClaim(
        productId,
        proof.a,
        proof.b,
        proof.c,
        proof.input
      );

      setStatus('Transaction Sent! Waiting for block confirmation...');
      await tx.wait();
      setStatus('Payout Successful! Money transferred.');
      checkPolicy(); // Refresh the display
    } catch (error) {
      console.error(error);
      setStatus('Transaction Failed: ' + (error.reason || error.message));
    }
  }

  return (
    <div
      style={{
        padding: '20px',
        fontFamily: 'Arial, sans-serif',
        maxWidth: '600px',
        margin: '0 auto',
      }}
    >
      <h1>❄️ ZK-ColdChain Dashboard</h1>

      {/* Section 1: Connect */}
      <div
        style={{
          marginBottom: '20px',
          padding: '15px',
          border: '1px solid #ccc',
          borderRadius: '8px',
        }}
      >
        <button
          onClick={connectWallet}
          style={{
            padding: '10px 20px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          {wallet ? 'Wallet Connected' : 'Connect MetaMask'}
        </button>
        <p>
          <strong>Status:</strong> {status}
        </p>
      </div>

      {/* Section 2: Check Status */}
      <div
        style={{
          marginBottom: '20px',
          padding: '15px',
          border: '1px solid #ccc',
          borderRadius: '8px',
        }}
      >
        <h3>1. Check Shipment</h3>
        <label>Product ID: </label>
        <input
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          style={{ marginLeft: '10px', padding: '5px', width: '60px' }}
        />
        <button
          onClick={checkPolicy}
          style={{ marginLeft: '10px', padding: '5px 10px', cursor: 'pointer' }}
        >
          Load Data
        </button>

        {policyData && (
          <div
            style={{
              marginTop: '15px',
              background: '#f8f9fa',
              padding: '10px',
            }}
          >
            <p>
              <strong>Locked Deposit:</strong> {policyData.deposit}
            </p>
            <p>
              <strong>Buyer Address:</strong> {policyData.buyer}
            </p>
            <p>
              <strong>Resolved?</strong> {policyData.isResolved}
            </p>
          </div>
        )}
      </div>

      {/* Section 3: Payout */}
      <div
        style={{
          marginBottom: '20px',
          padding: '15px',
          border: '2px solid #dc3545',
          borderRadius: '8px',
          background: '#fff5f5',
        }}
      >
        <h3>2. Submit ZK Proof</h3>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Paste the JSON object from your Colab script here.
        </p>
        <textarea
          rows="6"
          style={{ width: '100%', padding: '10px', fontFamily: 'monospace' }}
          placeholder='{ "a": [...], "b": [...], "c": [...], "input": [...] }'
          value={proofInput}
          onChange={(e) => setProofInput(e.target.value)}
        />
        <br />
        <button
          onClick={claimPayout}
          style={{
            marginTop: '10px',
            padding: '10px 20px',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Verify Breach & Claim Payout
        </button>
      </div>
    </div>
  );
}
