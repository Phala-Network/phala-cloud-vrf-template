# Phala Cloud VRF 

A Verifiable Random Function (VRF) implementation leveraging Trusted Execution Environment (TEE) technology on [Phala Cloud](https://cloud.phala.network/) and [DStack](https://github.com/dstack-TEE/dstack/). Delivers cryptographically verifiable randomness for Web3 applications with hardware-backed security and unprecedented efficiency.

## Key Advantages 🚀
### 1. **Cryptographically Verifiable Randomness**
- **TEE-Secured Computation**: Every random output is signed by a TEE-protected private key and can be independently verified on-chain through signature.
### 2. **Blazing Fast Performance**
- **Response as Flash**: Our event-driven architecture and TEE-derived-key mechanism ensures 2-4 seconds latency end-to-end.
### 3. **One-Click Deployment**
- **Phala Cloud Native**: We already built the template. Visit the [template](https://cloud.phala.network/templates/vrf) to try it!
### 4. **Production-Ready Infrastructure**
- **Mainnet-Proven**: Audited implementation supporting Base Sepolia & Sepolia & Abstract testnets
- **Live Demo**: [Video walkthrough](https://drive.google.com/file/d/1bp9ABKSiqz092Jz5e9QzmFlXBF9UEKM_/view?usp=sharing) demonstrating end-to-end workflow

The system comprises:
1. On-chain VRF Coordinator Contract
2. Off-chain VRF Generator (Confidential VM)
3. Client-facing API endpoints

## VRF Workflow

### 1. Initial Setup
```mermaid
sequenceDiagram
    participant ContractOwner
    participant Contract
    participant Offchain-VRF
  
    Offchain-VRF->>Offchain-VRF: Randomly generates wallet keypair (wallet_sk, wallet_address)
    Offchain-VRF->>Offchain-VRF: TEE generates signing keypair (signing_sk, signing_pubkey)
    ContractOwner->>Offchain-VRF: GET /address
    Offchain-VRF->>ContractOwner: Return wallet_address
    ContractOwner->>Contract: setTrustedThirdParty(wallet_address)
    ContractOwner->>Offchain-VRF: GET /pubkey
    Offchain-VRF->>ContractOwner: Return signing_pubkey
    ContractOwner->>Contract: updateOfflinePublicKey(signing_pubkey)
```

- **Trusted Wallet Identity Establishment**
  Offchain-VRF generates `wallet_sk` (private key) and derives `wallet_address`. Contract owner registers this address as trusted via `setTrustedThirdParty()`. And further transactions are sent from this wallet address.

- **OffChain Key Distribution by TEE**
  TEE generates separate `signing_sk` for VRF operations. Contract owner retrieves the corresponding public key via `/pubkey` endpoint and register it on-chain

### 2. Randomness Request Flow
```mermaid
sequenceDiagram
    participant User
    participant Contract
    participant Offchain-VRF
  
    User->>Contract: requestRandomNumber(seed)
    Contract->>Contract: Store request in queue
    Contract-->>Offchain-VRF: Emit RequestQueued(requestId, seed)
    Offchain-VRF->>Offchain-VRF: Listen for RequestQueued events
    Offchain-VRF->>Offchain-VRF: Compute random = VRF(signing_sk, seed)
    Offchain-VRF->>Offchain-VRF: Sign(requestId + seed + random)
    Offchain-VRF->>Contract: onRandomGenerated(requestId, random, signature)
    Contract->>Contract: Verify signature matches signing_pubkey
    Contract-->>Contract: Emit RandomFulfilled(requestId)
```

- **Request Initiation**
  Users submit randomness requests with unique seeds via `requestRandomNumber(seed)`

- **TEE Computation**
  Offchain-VRF monitors events and processes queued requests using:
  ```ts
  random = SHA256(signing_sk + seed)
  signature = ethers.Wallet.signMessage(signing_sk, solidityPackedKeccak256(requestId, seed, random))
  ```

- **On-chain Verification**
  Contract verifies using ECDSA recovery:
  ```solidity
  address recovered = ecrecover(hash, v, r, s);
  require(recovered == signing_pubkey, "Invalid signature");
  ```

## Key Features

- **TEE-Backed Security**
  - Secure key generation & storage in enclave
  - Memory encryption and attestation proofs

- **Verifiability**
  - Cryptographic proof of correct computation
  - On-chain signature verification

- **Fault Tolerance**
  - Automatic request retries
  - Transaction nonce management

- **Monitoring**
  - Real-time request tracking via API
  - Event history inspection

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/get_wallet` | GET | Returns TEE's operational wallet address |
| `/pubkey` | GET | Retrieves offline public key for VRF verification |

## Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/en) ≥ 18.18
- [Docker](https://www.docker.com/)
- Phala Cloud account

1. Clone repository:
```bash
git clone https://github.com/your-org/phala-cloud-vrf.git
cd phala-cloud-vrf
```

2. Configure environment:
```bash
cp env.local.example .env.local
# Set Ethereum RPC and contract address
```

3. Download and run TEE simulator:
```bash
wget https://github.com/Leechael/tappd-simulator/releases/download/v0.1.4/tappd-simulator-0.1.4-aarch64-apple-darwin.tgz
tar -xvf tappd-simulator-0.1.4-aarch64-apple-darwin.tgz
cd tappd-simulator-0.1.4-aarch64-apple-darwin
./tappd-simulator -l unix:/tmp/tappd.sock
```

4. Docker Compose:
```bash
docker-compose up
```

5. Run tests:
Use the contract address and localhost:3000 and the random seed to run `request.ts` to test the VRF workflow.


## Phala Cloud Deployment
Use `docker-compose.yml` to deploy on Phala Cloud.
Set ENV `RPC_URL` and `CONTRACT_ADDRESS` to setup.
Then use contract address and container network ip and the random seed to run `request.ts` to test the VRF workflow.

> You can also click the button below!

[![](https://cloud.phala.network/deploy-button.svg)](https://cloud.phala.network/templates/vrf)


## Demo Contract:

You can use the demo contract to test the VRF workflow. The contract is deployed on [Base Sepolia testnet](https://sepolia.basescan.org/address/0x945ac747bc520db5fc39447dfcee302190713825) and [Abstract testnent](https://explorer.testnet.abs.xyz/address/0xEe8A192A145f0C2D8596f14d4F636aFd15E65454).

You can check the transactions and events on the testnet. The speed of the transactions is fast, it only costs 2 blocks to generate the random number. If you want to test the VRF workflow, you can follow the steps above both on local and on the phala cloud.

Also we have a workflow demo [Video walkthrough](https://drive.google.com/file/d/1bp9ABKSiqz092Jz5e9QzmFlXBF9UEKM_/view?usp=sharing) 
