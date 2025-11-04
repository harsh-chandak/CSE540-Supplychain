import { expect } from 'chai'
import hre from 'hardhat'
import '@nomiclabs/hardhat-ethers'
const { ethers } = hre;

describe("SupplyChain (Draft)", function () {
  let supplyChain, owner, addr1, addr2;

  beforeEach(async function () {
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    addr1 = accounts[1];
    addr2 = accounts[2];

    const SupplyChain = await ethers.getContractFactory("SupplyChain");
    supplyChain = await SupplyChain.deploy();
    await supplyChain.deployed();
  });

  it("should register a product", async function () {
    const tx = await supplyChain.registerProduct(
      addr1.address,
      "SKU-001",
      "ipfs://example"
    );
    const receipt = await tx.wait();
    const event = receipt.events.find((e) => e.event === "ProductRegistered");

    expect(event.args.manufacturer).to.equal(addr1.address);
    expect(event.args.sku).to.equal("SKU-001");
  });
});
