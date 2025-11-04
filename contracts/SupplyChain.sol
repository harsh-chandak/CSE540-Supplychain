// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title SupplyChain Provenance (Draft)
/// @author Group 24
/// @notice Draft contract for tracking product provenance in a supply chain.
/// @dev This version includes only structure, events, and basic ownership transfer for the Draft Design submission.

import "@openzeppelin/contracts/access/Ownable.sol";

contract SupplyChain is Ownable {
    constructor() Ownable(msg.sender) {}
    uint256 private _nextId = 1;

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

    event ProductRegistered(
        uint256 indexed id,
        address indexed manufacturer,
        string sku,
        string metadataURI
    );

    event CustodyTransferred(
        uint256 indexed id,
        address indexed from,
        address indexed to,
        uint256 timestamp,
        string notes
    );

    /// @notice Register a new product by manufacturer.
    /// @param manufacturer The address of the product manufacturer.
    /// @param sku Product identifier or SKU code.
    /// @param metadataURI IPFS or HTTPS link to metadata.
    /// @return productId The assigned product ID.
    function registerProduct(
        address manufacturer,
        string calldata sku,
        string calldata metadataURI
    ) external onlyOwner returns (uint256 productId) {
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

    /// @notice Transfer custody of a product to another participant.
    /// @param productId ID of the product to transfer.
    /// @param to Address receiving the product.
    /// @param notes Optional description of transfer.
    function transferCustody(
        uint256 productId,
        address to,
        string calldata notes
    ) external {
        require(products[productId].exists, "Product does not exist");
        require(msg.sender == products[productId].currentOwner, "Not current owner");

        address from = products[productId].currentOwner;
        products[productId].currentOwner = to;

        emit CustodyTransferred(productId, from, to, block.timestamp, notes);
    }

    /// @notice Retrieve details of a product.
    /// @param productId ID of the product.
    /// @return Product struct containing product information.
    function getProduct(uint256 productId) external view returns (Product memory) {
        require(products[productId].exists, "Product not found");
        return products[productId];
    }

    /// @notice Check if a product exists.
    /// @param productId ID to check.
    /// @return True if exists, false otherwise.
    function productExists(uint256 productId) external view returns (bool) {
        return products[productId].exists;
    }
}
