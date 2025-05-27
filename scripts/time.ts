import { ethers } from "ethers";
import crypto from 'crypto';

// Hardcoded values for testing
const seed = 30n;
const rootKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
const requestId = 1n;

// Function to generate random number (copied from your code)
function generateRandom(seed: bigint, rootKey: string): bigint {
    const hash = crypto.createHash('sha256')
        .update(seed.toString() + rootKey.toString())
        .digest('hex');
    return BigInt('0x' + hash) % (10n ** 18n); // Generate deterministic 18-digit random number
}

// Function to time the operations
async function testRandomGeneration() {
    console.log("Starting performance test...");
    
    // Test random number generation
    console.log("\nTesting random number generation:");
    const startRandom = performance.now();
    const random = generateRandom(seed, rootKey);
    const endRandom = performance.now();
    console.log(`Random number generated: ${random}`);
    console.log(`Time taken for random number generation: ${endRandom - startRandom} ms`);
    
    // Test signature generation
    console.log("\nTesting signature generation:");
    const startSignature = performance.now();
    
    // Construct message hash
    const messageHash = ethers.solidityPackedKeccak256(
        ["uint256", "uint256", "uint256"],
        [requestId, seed, random]
    );
    
    // Sign message
    const rootSigner = new ethers.Wallet(rootKey);
    const signature = await rootSigner.signMessage(ethers.getBytes(messageHash));
    
    const endSignature = performance.now();
    console.log(`Signature generated: ${signature}`);
    console.log(`Time taken for signature generation: ${endSignature - startSignature} ms`);
    
    // Total time
    console.log(`\nTotal time: ${endSignature - startRandom} ms`);
}

// Run the test
testRandomGeneration().catch(error => {
    console.error("Error during test:", error);
});