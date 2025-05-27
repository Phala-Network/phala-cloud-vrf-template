import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
import { abstractTestnet } from 'viem/chains';
import { exec } from 'child_process';
import { promisify } from 'util';
dotenv.config();

const execAsync = promisify(exec);

// Configuration
const PRIVATE_KEY = process.argv[5]
const RPC_URL = process.argv[6]

// Initialize wallet client
const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({ account, chain: abstractTestnet, transport: http(RPC_URL) });
const abi = JSON.parse(require('fs').readFileSync('./artifacts/VRFCoordinatorAbi.json', 'utf-8'));

/**
 * Request a random number from the VRF coordinator contract
 * @param contractAddress The address of the VRF coordinator contract
 */
async function requestRandomNumber(contractAddress: string, seed: number = 30) {
  // calculate running time in seconds
  const publicClient = createPublicClient({
    chain: abstractTestnet,
    transport: http(RPC_URL),
  });
  const startTime = performance.now();
  const hash = await walletClient.writeContract({
    address: contractAddress as `0x${string}`,
    abi: abi,
    functionName: 'requestRandomNumber',
    args: [seed], // seed=30
  });
  const middleTime = performance.now();
  console.log(`Time taken for requestRandomNumber: ${middleTime - startTime} milliseconds`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const endTime = performance.now();
  const runningTime = endTime - middleTime;
  console.log(`Running receipt time: ${runningTime} milliseconds`);
  console.log(`Total time: ${endTime - startTime} milliseconds`);
  console.log('Request Random Number confirmed at block: ', receipt.blockNumber);
}

/**
 * Update the offchain public key in the VRF coordinator contract
 * @param contractAddress The address of the VRF coordinator contract
 * @param publicKey The public key to set
 */
async function updateOffchainPublicKey(contractAddress: string, publicKey: string) {
  const hash = await walletClient.writeContract({
    address: contractAddress as `0x${string}`,
    abi: JSON.parse(require('fs').readFileSync('./artifacts/VRFCoordinatorAbi.json', 'utf-8')),
    functionName: 'updateOffchainPublicKey',
    args: [publicKey as `0x${string}`],
  });

  const publicClient = createPublicClient({
    chain: abstractTestnet,
    transport: http(RPC_URL),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Update Offchain Public Key Tx hash:', receipt.transactionHash);
}

/**
 * Set the trusted third party in the VRF coordinator contract
 * @param contractAddress The address of the VRF coordinator contract
 * @param walletAddress The wallet address to set as trusted third party
 */
async function setTrustedThirdParty(contractAddress: string, walletAddress: string) {
  const hash = await walletClient.writeContract({
    address: contractAddress as `0x${string}`,
    abi: JSON.parse(require('fs').readFileSync('./artifacts/VRFCoordinatorAbi.json', 'utf-8')),
    functionName: 'setTrustedThirdParty',
    args: [walletAddress as `0x${string}`],
  });

  const publicClient = createPublicClient({
    chain: abstractTestnet,
    transport: http(RPC_URL),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Set Trusted Third Party Tx hash:', receipt.transactionHash);
}

/**
 * Send ETH to the trusted third party address
 * @param walletAddress The wallet address to send ETH to
 */
async function sendEthToTrustedParty(walletAddress: string) {
  const hash = await walletClient.sendTransaction({
    to: walletAddress as `0x${string}`,
    value: BigInt('100000000000000'), // 0.0001 ETH in wei
  });

  const publicClient = createPublicClient({
    chain: abstractTestnet,
    transport: http(RPC_URL),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Send ETH Tx hash:', receipt.transactionHash);
}

/**
 * Get the wallet address from the API
 * @param baseUrl The base URL of the API
 * @returns The wallet address
 */
async function getWalletAddress(baseUrl: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`curl -s "${baseUrl}/get_wallet"`);
    const response = JSON.parse(stdout);
    return response.Ethereum_wallet_address;
  } catch (error) {
    console.error('Failed to get wallet address:', error);
    throw error;
  }
}

/**
 * Get the public key from the API
 * @param baseUrl The base URL of the API
 * @returns The public key
 */
async function getPublicKey(baseUrl: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`curl -s "${baseUrl}/pubkey"`);
    const response = JSON.parse(stdout);
    return response.address;
  } catch (error) {
    console.error('Failed to get public key:', error);
    throw error;
  }
}

/**
 * Main function to execute the three-step process
 * @param baseUrl The base URL of the API
 * @param contractAddress The address of the VRF coordinator contract
 */
async function main(baseUrl: string, contractAddress: string, seed: number) {
  try {
    console.log('Starting three-step process...');
    
    // Step 1: Get wallet address and set trusted third party
    console.log('\nStep 1: Setting trusted third party...');
    const walletAddress = await getWalletAddress(baseUrl);
    console.log('Retrieved wallet address:', walletAddress);
    await setTrustedThirdParty(contractAddress, walletAddress);
    
    // Step 2: Send ETH to trusted third party
    console.log('\nStep 2: Sending ETH to trusted third party...');
    await sendEthToTrustedParty(walletAddress);
    
    // Step 3: Get public key and update offchain public key
    console.log('\nStep 3: Updating offchain public key...');
    const publicKey = await getPublicKey(baseUrl);
    console.log('Retrieved public key:', publicKey);
    await updateOffchainPublicKey(contractAddress, publicKey);
    
    // Step 4: Request random number
    console.log('\nStep 4: Requesting random number...');
    await requestRandomNumber(contractAddress, seed);
    
    console.log('\nAll steps completed successfully!');
  } catch (error) {
    console.error('Error during execution:', error);
  }
}

// Parse command line arguments
// Usage: npx ts-node scripts/request.ts [baseUrl] [contractAddress] [seed] [private_key] [rpc_url]
// Example: npx ts-node scripts/request.ts https://example-api.phala.network 0xc0A0d84fBB3D9fc240c4aD482135810Bda7F375A 30 private_key rpc_url
const baseUrl = process.argv[2];
const contractAddress = process.argv[3];
const seed = process.argv[4];

console.log(`Using API base URL: ${baseUrl}`);
console.log(`Using contract address: ${contractAddress}`);
console.log(`Using seed: ${seed}`);

// Execute main function with parameters
main(baseUrl, contractAddress, Number(seed)).catch(console.error);
