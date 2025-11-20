pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";

template TemperatureCheck(n) {
    // --- Inputs ---
    signal input readings[n];     // The private temperature log
    signal input secretSalt;      // Private salt to secure the hash
    signal input maxTemp;         // Public rule (e.g., 8 degrees)

    // --- Outputs ---
    signal output dataHash;       // Public anchor (links to Smart Contract)
    signal output isBreach;       // Public result (1 = breach, 0 = safe)

    // --- 1. Integrity Check (Calculate Hash) ---
    // We use Poseidon hash (standard in ZK) to fingerprint the data
    component hasher = Poseidon(n + 1);
    for (var i = 0; i < n; i++) {
        hasher.inputs[i] <== readings[i];
    }
    hasher.inputs[n] <== secretSalt;
    dataHash <== hasher.out;

    // --- 2. Compliance Check (Logic) ---
    signal breachCount[n+1];
    breachCount[0] <== 0;

    component gt[n];

    for (var i = 0; i < n; i++) {
        // Check if readings[i] > maxTemp
        gt[i] = GreaterThan(64);
        gt[i].in[0] <== readings[i];
        gt[i].in[1] <== maxTemp;

        // Accumulate breaches
        breachCount[i+1] <== breachCount[i] + gt[i].out;
    }

    // If breachCount > 0, then isBreach = 1, else 0
    component isPositive = GreaterThan(64);
    isPositive.in[0] <== breachCount[n];
    isPositive.in[1] <== 0;

    isBreach <== isPositive.out;
}

// We define a circuit with 5 readings for this demo
component main {public [maxTemp]} = TemperatureCheck(5);
