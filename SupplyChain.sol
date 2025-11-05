// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SupplyChain {
    uint256 private _nextId;

    struct Product {
        uint256 id;
        address manufacturer;
        string sku;
        string metadataURI;
        uint256 createdAt;
        address currentOwner;
        bool exists;
    }

    mapping(uint256 => Product) private products;

    event ProductRegistered(uint256 indexed id, address indexed manufacturer, string sku, string metadataURI);
    event CustodyTransferred(uint256 indexed id, address indexed from, address indexed to, uint256 timestamp, string notes);

    constructor() {
        _nextId = 1;
    }

    function registerProduct(address manufacturer, string calldata sku, string calldata metadataURI) external returns (uint256 productId) {
        productId = _nextId++;
        products[productId] = Product({
            id: productId,
            manufacturer: manufacturer,
            sku: sku,
            metadataURI: metadataURI,
            createdAt: block.timestamp,
            currentOwner: manufacturer,
            exists: true
        });
        emit ProductRegistered(productId, manufacturer, sku, metadataURI);
    }

    function transferCustody(uint256 productId, address to, string calldata notes) external {
        require(products[productId].exists, "Product does not exist");
        require(msg.sender == products[productId].currentOwner, "Only current owner can transfer");

        address from = products[productId].currentOwner;
        products[productId].currentOwner = to;

        emit CustodyTransferred(productId, from, to, block.timestamp, notes);
    }

    function getProduct(uint256 productId) external view returns (Product memory) {
        require(products[productId].exists, "Product not found");
        return products[productId];
    }
}
