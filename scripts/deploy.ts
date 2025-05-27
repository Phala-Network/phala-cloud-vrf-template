import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync } from 'fs'
import { join } from 'path'
import 'dotenv/config'
import { abstractTestnet } from 'viem/chains'

const contractPath = join(__dirname, '../artifacts')
const abi = JSON.parse(readFileSync(join(contractPath, 'VRFCoordinatorAbi.json'), 'utf8'))
const bytecode = readFileSync(join(contractPath, 'VRFCoordinatorBytecode.txt'), 'utf8')

// Get private key and RPC URL from command line arguments
// Usage: npx ts-node scripts/deploy.ts <private_key> <rpc_url>
const privateKey = process.argv[2]
const rpcUrl = process.argv[3]
const publicClient = createPublicClient({
    chain: abstractTestnet,
    transport: http(rpcUrl),
});

const account = privateKeyToAccount(privateKey as `0x${string}`)
const walletClient = createWalletClient({
    account,
    chain: abstractTestnet,
    transport: http(rpcUrl)
});

async function main() {
    console.log('Deploying VRFCoordinator...')
    const hash = await walletClient.deployContract({
        abi,
        bytecode: `0x${bytecode}` as `0x${string}`,
        args: []
    })

    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    console.log('VRFCoordinator deployed at:', receipt.contractAddress)
    return receipt.contractAddress
}

main().catch(console.error)