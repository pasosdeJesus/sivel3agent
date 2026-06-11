import { expect } from "chai";
import { ethers } from "hardhat";

describe.skip("MockUSDT", function () {
  it("Should deploy with correct name and symbol", async function () {
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();

    expect(await mockUSDT.name()).to.equal("Mock USDT");
    expect(await mockUSDT.symbol()).to.equal("MUSDT");
    expect(await mockUSDT.decimals()).to.equal(6);
  });

  it("Should have initial supply of 0 tokens", async function () {
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();

    const totalSupply = await mockUSDT.totalSupply();
    expect(totalSupply).to.equal(0);
  });

  it("Should allow transfers", async function () {
    const [owner, recipient] = await ethers.getSigners();
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();

    // Mint tokens to owner first
    const mintAmount = ethers.parseUnits("1000", 6);
    await mockUSDT.mint(owner.address, mintAmount);

    const transferAmount = ethers.parseUnits("100", 6);
    await mockUSDT.transfer(recipient.address, transferAmount);

    const recipientBalance = await mockUSDT.balanceOf(recipient.address);
    expect(recipientBalance).to.equal(transferAmount);
  });
});