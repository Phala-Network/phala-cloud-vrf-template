// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VRFCoordinator {
    struct Request {
        address caller; // Requester address
        uint256 seed; // User-provided seed
        bool fulfilled; // Fulfillment status
    }

    Request[] public requests; // Request queue
    address public offchainPublicKey; // Offchain service public key
    address public owner; // Contract owner (for access control)
    address public trustedTEE; // Trusted third-party (TEE for random number generation and public key updates)

    event RequestQueued(
        uint256 indexed requestId,
        address indexed caller,
        uint256 seed
    );
    event RandomFulfilled(uint256 indexed requestId, uint256 random);
    event OffchainPublicKeyUpdated(
        address indexed oldPublicKey,
        address indexed newPublicKey
    );
    event TrustedThirdPartyAdded(address indexed trustedTEE);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // Submit seed to request queue
    function requestRandomNumber(uint256 _seed) external {
        uint256 requestId = requests.length;
        requests.push(Request(msg.sender, _seed, false));
        emit RequestQueued(requestId, msg.sender, _seed);
    }

    // Offchain service callback: submit signed random number
    function onRandomGenerated(
        uint256 _requestId,
        uint256 _random,
        bytes calldata _signature
    ) external {
        Request storage request = requests[_requestId];
        require(!request.fulfilled, "Request already fulfilled");

        // Verify signature validity (signed content: requestId + seed + random)
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(_requestId, request.seed, _random))
            )
        );
        require(
            _isValidSignature(messageHash, _signature),
            "Invalid signature"
        );

        request.fulfilled = true;
        emit RandomFulfilled(_requestId, _random);
    }

    // Signature verification
    function _isValidSignature(
        bytes32 _hash,
        bytes memory _signature
    ) internal view returns (bool) {
        require(_signature.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := byte(0, mload(add(_signature, 96)))
        }
        if (v < 27) v += 27;
        return ecrecover(_hash, v, r, s) == offchainPublicKey;
    }

    // Set trusted TEE address
    function setTrustedThirdParty(
        address _trustedThirdParty
    ) external onlyOwner {
        require(_trustedThirdParty != address(0), "Invalid address");
        trustedTEE = _trustedThirdParty;
        emit TrustedThirdPartyAdded(trustedTEE);
    }

    // Update offchain service public key
    function updateOffchainPublicKey(address _newPublicKey) external onlyOwner {
        require(_newPublicKey != address(0), "Invalid public key");
        address oldPublicKey = offchainPublicKey;
        offchainPublicKey = _newPublicKey;
        emit OffchainPublicKeyUpdated(oldPublicKey, _newPublicKey);
    }

    // Get pending request count
    function getPendingRequestCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < requests.length; i++) {
            if (!requests[i].fulfilled) count++;
        }
        return count;
    }

    // Get request details
    function getRequest(
        uint256 _requestId
    ) external view returns (Request memory) {
        return requests[_requestId];
    }
}
