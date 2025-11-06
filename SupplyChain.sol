// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * SupplyChain (with window-root commits for Proof-of-Cold)
 *
 * Core features
 * - Register product (manufacturer = caller), read/list, transfer custody
 * - Simple lifecycle status (Created/Shipped/Received/Delivered)
 * - Light roles: admin manages regulators (for certify) and committers (gateway(s))
 * - commitWindowRoot(id, w, root) to append a tamper-evident timeline
 * - stopAndSeal(id, rootOfRoots) to finalize the diary for ZK verification
 *
 * Notes
 * - No external imports; compiles in Remix.
 * - Events are indexed for easy off-chain filtering.
 * - Guards for empty SKU, bad ids, non-zero addresses, order of window commits.
 */
contract SupplyChain {
    // --- Roles (lightweight) ---
    address public admin;                        // deployer is admin
    mapping(address => bool) public regulators;  // admin-managed
    mapping(address => bool) public committers;  // who can push window roots (e.g., your gateway)

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin");
        _;
    }

    modifier onlyCommitter() {
        require(committers[msg.sender], "not a committer");
        _;
    }

    event RegulatorUpdated(address indexed account, bool allowed);
    event CommitterUpdated(address indexed account, bool allowed);

    // --- Product model ---
    enum Status { Created, Shipped, Received, Delivered }

    struct Product {
        uint256 id;
        address manufacturer;
        address currentOwner;
        string  sku;
        string  metadataURI; // e.g., ipfs://CID or https://...
        uint256 createdAt;
        Status  status;
        bool    certified;   // set by a regulator
        bool    exists;      // guards bad ids
    }

    // storage
    uint256 private nextId = 1;
    mapping(uint256 => Product) private products;
    uint256[] private productIds;

    // --- Window-root timeline (Proof-of-Cold) ---
    // productId -> windowIdx -> Merkle root for that window
    mapping(uint256 => mapping(uint32 => bytes32)) public windowRoot;
    // productId -> last committed window index (starts at 0)
    mapping(uint256 => uint32) public lastWindow;
    // productId -> whether the shipment has been sealed (no more commits)
    mapping(uint256 => bool) private shipmentSealed;
    // productId -> final root that commits all window roots (root of roots)
    mapping(uint256 => bytes32) public sealedRoot;

    // Events for the timeline flow
    event WindowCommitted(uint256 indexed productId, uint32 indexed windowIdx, bytes32 root, uint64 ts);
    event ShipmentSealed(uint256 indexed productId, bytes32 rootOfRoots, uint64 ts);

    // --- Business events ---
    event ProductRegistered(uint256 indexed productId, address indexed manufacturer, string sku, string metadataURI);
    event CustodyTransferred(uint256 indexed productId, address indexed from, address indexed to, string notes);
    event StatusUpdated(uint256 indexed productId, Status status, string notes);
    event ProductCertified(uint256 indexed productId, address indexed regulator, string note);

    // --- Constructor ---
    constructor() {
        admin = msg.sender;
    }

    // --- Admin/roles ---
    function setRegulator(address account, bool allowed) external onlyAdmin {
        regulators[account] = allowed;
        emit RegulatorUpdated(account, allowed);
    }

    function setCommitter(address account, bool allowed) external onlyAdmin {
        committers[account] = allowed;
        emit CommitterUpdated(account, allowed);
    }

    // --- Core: register / read / list ---
    function registerProduct(
        string calldata sku,
        string calldata metadataURI
    ) external returns (uint256 productId) {
        require(bytes(sku).length > 0, "sku required");

        productId = nextId++;
        products[productId] = Product({
            id: productId,
            manufacturer: msg.sender,
            currentOwner: msg.sender,
            sku: sku,
            metadataURI: metadataURI,
            createdAt: block.timestamp,
            status: Status.Created,
            certified: false,
            exists: true
        });

        productIds.push(productId);
        emit ProductRegistered(productId, msg.sender, sku, metadataURI);
    }

    function getProduct(uint256 productId)
        external
        view
        returns (
            uint256 id,
            address manufacturer,
            address currentOwner,
            string memory sku,
            string memory metadataURI,
            uint256 createdAt,
            Status status,
            bool certified
        )
    {
        Product storage p = _productMustExist(productId);
        return (
            p.id,
            p.manufacturer,
            p.currentOwner,
            p.sku,
            p.metadataURI,
            p.createdAt,
            p.status,
            p.certified
        );
    }

    function getAllProductIds() external view returns (uint256[] memory) {
        return productIds;
    }

    function totalProducts() external view returns (uint256) {
        return productIds.length;
    }

    function currentOwnerOf(uint256 productId) external view returns (address) {
        return _productMustExist(productId).currentOwner;
    }

    // --- Transfers & status ---
    function transferCustody(
        uint256 productId,
        address to,
        string calldata notes
    ) external {
        Product storage p = _productMustExist(productId);
        require(msg.sender == p.currentOwner, "only current owner can transfer");
        require(to != address(0), "invalid 'to' address");

        address from = p.currentOwner;
        p.currentOwner = to;
        emit CustodyTransferred(productId, from, to, notes);
    }

    function updateStatus(
        uint256 productId,
        Status newStatus,
        string calldata notes
    ) external {
        Product storage p = _productMustExist(productId);
        require(
            msg.sender == p.currentOwner || msg.sender == p.manufacturer,
            "only owner or manufacturer"
        );
        p.status = newStatus;
        emit StatusUpdated(productId, newStatus, notes);
    }

    function certify(uint256 productId, string calldata note) external {
        Product storage p = _productMustExist(productId);
        require(regulators[msg.sender], "only regulator");
        p.certified = true;
        emit ProductCertified(productId, msg.sender, note);
    }

    // --- Window commits + seal (for Proof-of-Cold) ---

    /**
     * Append a Merkle-root "receipt" for the next window of readings.
     * Requirements:
     *  - product must exist and not be sealed
     *  - window index must be exactly lastWindow[id] + 1 (prevents edits/reordering)
     *  - caller must be an allowed committer (your gateway)
     */
    function commitWindowRoot(uint256 productId, uint32 windowIdx, bytes32 root) external onlyCommitter {
        _productMustExist(productId);
        require(!shipmentSealed[productId], "already sealed");
        require(windowIdx == lastWindow[productId] + 1, "out of order");
        windowRoot[productId][windowIdx] = root;
        lastWindow[productId] = windowIdx;
        emit WindowCommitted(productId, windowIdx, root, uint64(block.timestamp));
    }

    /**
     * Finalize the shipment by storing a single root that commits all window roots.
     * Only the manufacturer or current owner can seal.
     * After sealing, further window commits are rejected.
     */
    function stopAndSeal(uint256 productId, bytes32 rootOfRoots) external {
        Product storage p = _productMustExist(productId);
        require(!shipmentSealed[productId], "already sealed");
        require(
            msg.sender == p.currentOwner || msg.sender == p.manufacturer,
            "only owner or manufacturer"
        );
        shipmentSealed[productId] = true;
        sealedRoot[productId] = rootOfRoots;
        emit ShipmentSealed(productId, rootOfRoots, uint64(block.timestamp));
    }

    // Convenience views
    function isSealed(uint256 productId) external view returns (bool) {
        return shipmentSealed[productId];
    }

    function lastCommittedWindow(uint256 productId) external view returns (uint32) {
        return lastWindow[productId];
    }

    // --- Internal helper ---
    function _productMustExist(uint256 productId)
        internal
        view
        returns (Product storage p)
    {
        p = products[productId];
        require(p.exists, "unknown productId");
    }
}
