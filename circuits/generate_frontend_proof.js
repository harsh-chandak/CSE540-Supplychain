const snarkjs = require("snarkjs");
const fs = require("fs");

async function run() {
    // DATA SIMULATION
    // We inject a '10' degree reading which violates the maxTemp of '8'
    const readings = [7, 6, 8, 10, 7];
    const maxTemp = 8;
    const secretSalt = "12345";
    const input = { "readings": readings, "secretSalt": secretSalt, "maxTemp": maxTemp };

    // PROOF GENERATION
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input, "temperature_js/temperature.wasm", "circuit_final.zkey"
    );

    // FORMATTING FOR FRONTEND
    const proofForFrontend = {
        a: [proof.pi_a[0], proof.pi_a[1]],
        b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
        c: [proof.pi_c[0], proof.pi_c[1]],
        input: publicSignals
    };

    console.log("\n👇 COPY THE JSON BELOW FOR YOUR FRONTEND 👇");
    console.log("---------------------------------------------------");
    console.log(JSON.stringify(proofForFrontend, null, 2));
    console.log("---------------------------------------------------");

    console.log("\nrootOfRoots (Use this to seal in Remix):");
    console.log("0x" + BigInt(publicSignals[0]).toString(16));
}

run().then(() => process.exit(0));
