import { ethers } from "ethers";
import { createPublicClient, http, Log } from 'viem';
import { readFileSync } from 'fs'
import { TappdClient } from '@phala/dstack-sdk';
import dotenv from 'dotenv';
import crypto from 'crypto';
import express from 'express';
import { privateKeyToAccount } from "viem/accounts";
dotenv.config();

export const dynamic = 'force-dynamic'

// --------------------- Configuration ---------------------
const RPC_URL = process.env.RPC_URL; // Ethereum RPC URL, set through environment variables
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS; // VRFCoordinator contract address, set through environment variables
const provider = new ethers.JsonRpcProvider(RPC_URL);
const initWallet = async () => {
    const client = new TappdClient();
    await client.info();
    const testDeriveKey = await client.deriveKey("wallet");
    const key = Array.from(testDeriveKey.asUint8Array(32)).map(b => b.toString(16).padStart(2, '0')).join('')
    const walletSecretKey = key.startsWith('0x') ? key : `0x${key}`;
    const teeWallet = new ethers.Wallet(walletSecretKey, provider); // generate a random wallet in TEE
    return { teeWallet };
};

// Check balance
let balance: bigint = 0n;
(async () => {
    const { teeWallet } = await initWallet();
    balance = await provider.getBalance(teeWallet.address);
    console.log(`Current balance: ${ethers.formatEther(balance)} SEP`);
})();
const VRFCoordinatorABI = JSON.parse(readFileSync('./artifacts/VRFCoordinatorAbi.json', 'utf-8'));
let vrfCoordinator: ethers.Contract;

let rootKey: string;

// --------------------- Monitor Queue ---------------------
const publicClient = createPublicClient({
    transport: http(RPC_URL)
});

interface RequestQueuedEvent {
    requestId: bigint;
    caller: `0x${string}`;
    seed: bigint;
}

// Initialization function
async function initialize() {
    try {
        // Initialize keys
        rootKey = await initKeys();
        console.log('Key initialization completed');

        // Initialize vrfCoordinator
        const { teeWallet } = await initWallet();
        vrfCoordinator = new ethers.Contract(
            CONTRACT_ADDRESS!,
            VRFCoordinatorABI,
            teeWallet
        );
        console.log('VRFCoordinator initialized');
    } catch (error) {
        console.error('Initialization failed:', error);
        process.exit(1);
    }
}

const app = express();
app.use(express.json());
app.get('/get_wallet', async (req, res) => {
    try {
        const { teeWallet } = await initWallet();
        const address = teeWallet.address;
        res.json({ Ethereum_wallet_address: address });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/pubkey', async (req, res) => {
    try {
        const pubKey = getPubKey();
        res.json({ address: pubKey });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/update-secretkey', async (req, res) => {
    try {
        updateSecretKey();
        res.json({
            status: 'success',
            message: 'Private key updated',
            new_pubkey: getPubKey()
        });
    } catch (error) {
        console.error('Update failed:', error);
        const statusCode = (error as any).statusCode || 500;
        res.status(statusCode).json({
            error: (error as Error).message,
            statusCode
        });
    }
});

// Wrap async initialization in immediately executed function
(async () => {
    await initialize();
    app.listen(3000, () => {
        console.log('Key API server running on port 3000');
    });
})().catch(error => {
    console.error('Error in initialization process:', error);
    process.exit(1);
});

publicClient.watchContractEvent({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: VRFCoordinatorABI,
    eventName: 'RequestQueued',
    onLogs: async (logs: Log[]) => {
        for (const log of logs) {
            const { requestId, caller, seed } = (log as any).args as RequestQueuedEvent;
            await processRequest(requestId, seed);
        }
    }
});

// --------------------- Process Request ---------------------
async function processRequest(requestId: bigint, seed: bigint): Promise<void> {
    // 1. Generate random number (based on seed + global key)
    const startTime = performance.now();
    const startRandomTime = performance.now();
    const random = generateRandom(seed, rootKey);
    const endRandomTime = performance.now();
    console.log(`Time taken for generateRandom: ${endRandomTime - startRandomTime} milliseconds`);

    // 2. Construct signature message (requestId + seed + random)
    const startSignatureTime = performance.now();
    const messageHash = ethers.solidityPackedKeccak256(
        ["uint256", "uint256", "uint256"],
        [requestId, seed, random]
    );
    // 3. Sign message
    const rootSigner = new ethers.Wallet(rootKey, provider);
    const signature = await rootSigner.signMessage(ethers.getBytes(messageHash));
    const endSignatureTime = performance.now();
    console.log(`Time taken for construct signature message: ${endSignatureTime - startSignatureTime} milliseconds`);

    // 4. Submit to chain
    const startSubmitTime = performance.now();
    const tx = await vrfCoordinator.onRandomGenerated(
        requestId,
        random,
        signature
    );
    const receipt = await tx.wait();
    const endSubmitTime = performance.now();
    console.log(`Time taken for submit to chain: ${endSubmitTime - startSubmitTime} milliseconds`);
    console.log(`onRandomGenerated Transaction confirmed in block ${receipt?.blockNumber}`);
    const endTime = performance.now();
    console.log(`Total time: ${endTime - startTime} milliseconds`);
}

// --------------------- Init Keys ---------------------
async function initKeys(): Promise<string> {
    const client = new TappdClient();
    await client.info();
    const testDeriveKey = await client.deriveKey("ethereum");
    const key = Array.from(testDeriveKey.asUint8Array(32)).map(b => b.toString(16).padStart(2, '0')).join('')
    return key.startsWith('0x') ? key : `0x${key}`;
}

// --------------------- Update Private Key -------------------------
function updateSecretKey(): void {
    const salt = crypto.randomBytes(16); // random salt
    const derivedKey = crypto.pbkdf2Sync(
        rootKey,
        salt,
        10,     // iterations
        32,     // output key length
        'sha256'
    );
    const keyInt = BigInt('0x' + derivedKey.toString('hex')) %
        BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
    rootKey = '0x' + keyInt.toString(16).padStart(64, '0');
    console.log('Private key update completed');
}

// --------------------- Get Public Key Address ---------------------
function getPubKey(): string {
    const pubkey = privateKeyToAccount(rootKey as `0x${string}`).address;
    return pubkey;
}

// --------------------- Secure Random Number Generation ---------------------
function generateRandom(seed: bigint, rootKey: string): bigint {
    const hash = crypto.createHash('sha256')
        .update(seed.toString() + rootKey.toString())
        .digest('hex');
    return BigInt('0x' + hash) % (10n ** 18n); // Generate deterministic 18-digit random number
}

// --------------------- Start Monitoring ---------------------
console.log("OffChain processor started...");