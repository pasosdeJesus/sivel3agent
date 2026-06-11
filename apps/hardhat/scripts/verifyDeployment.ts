import { ethers } from "hardhat";
import dotenv from "dotenv"
dotenv.config({ path: '../.env' })

async function main() {
  // Get the deployed contract
  const learnTGVaults = await ethers.getContractAt(
    "LearnTGVaults",
    process.env.NEXT_PUBLIC_DEPLOYED_AT  // The deployed address
  );
  console.log("📜 LearnTGVaults Verification");
  console.log("=============================");
  console.log("Contract address:", process.env.NEXT_PUBLIC_DEPLOYED_AT);

  // Get the owner of the contract
  const owner = await learnTGVaults.owner();
  console.log("\n👤 Contract owner:", owner);

  // Get the USDT token address that the contract was initialized with
  const usdtToken = await learnTGVaults.usdtToken();
  console.log("💰 Contract USDT token address:", usdtToken);

  // Get the cCop token address that the contract was initialized with
  const cCopToken = await learnTGVaults.cCopToken();
  console.log("🔶 Contract cCop token address:", cCopToken);

  // Get the gooddollar token address that the contract was initialized with
  const gooddollarToken = await learnTGVaults.gooddollarToken();
  console.log("💎 Contract gooddollar token address:", gooddollarToken);

  // Get provider
  const provider = ethers.provider;

  // Get USDT contract instance
  const usdtContract = await ethers.getContractAt("IERC20", usdtToken);
  const usdtDecimals = process.env.NEXT_PUBLIC_USDT_DECIMALS ? parseInt(process.env.NEXT_PUBLIC_USDT_DECIMALS) : 6;

  console.log("\n📊 Balance Verification");
  console.log("=====================");

  // 1. Check contract USDT balance
  const contractUSDTBalance = await usdtContract.balanceOf(learnTGVaults.target);
  const formattedContractUSDT = ethers.formatUnits(contractUSDTBalance, usdtDecimals);
  console.log(`1. LearnTGVaults USDT balance: ${formattedContractUSDT} USDT`);

  // 2. Check contract CELO balance
  const contractCELOBalance = await provider.getBalance(learnTGVaults.target);
  const formattedContractCELO = ethers.formatEther(contractCELOBalance);
  console.log(`2. LearnTGVaults CELO balance: ${formattedContractCELO} CELO`);

  // 3. Check owner USDT balance
  const ownerUSDTBalance = await usdtContract.balanceOf(owner);
  const formattedOwnerUSDT = ethers.formatUnits(ownerUSDTBalance, usdtDecimals);
  console.log(`3. Owner USDT balance: ${formattedOwnerUSDT} USDT`);

  // 4. Check owner CELO balance
  const ownerCELOBalance = await provider.getBalance(owner);
  const formattedOwnerCELO = ethers.formatEther(ownerCELOBalance);
  console.log(`4. Owner CELO balance: ${formattedOwnerCELO} CELO`);

  // 5. Check deployer account (from private key) balances if available
  if (process.env.PRIVATE_KEY) {
    const deployerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const deployerAddress = deployerWallet.address;
    const deployerUSDTBalance = await usdtContract.balanceOf(deployerAddress);
    const deployerCELOBalance = await provider.getBalance(deployerAddress);
    console.log(`\n🔑 Deployer account (from PRIVATE_KEY):`);
    console.log(`   Address: ${deployerAddress}`);
    console.log(`   USDT: ${ethers.formatUnits(deployerUSDTBalance, usdtDecimals)} USDT`);
    console.log(`   CELO: ${ethers.formatEther(deployerCELOBalance)} CELO`);
  }

  // 6. Check old Hardhat account #0 (common test account)
  const hardhatAccount0 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const hardhatUSDTBalance = await usdtContract.balanceOf(hardhatAccount0);
  const hardhatCELOBalance = await provider.getBalance(hardhatAccount0);
  console.log(`\n🧪 Hardhat account #0 (common test):`);
  console.log(`   Address: ${hardhatAccount0}`);
  console.log(`   USDT: ${ethers.formatUnits(hardhatUSDTBalance, usdtDecimals)} USDT`);
  console.log(`   CELO: ${ethers.formatEther(hardhatCELOBalance)} CELO`);

  console.log("\n✅ Contract deployed and verified successfully!");
  console.log("\n📋 Summary:");
  console.log("   • LearnTGVaults contract is deployed and accessible");
  console.log("   • Verify contract has sufficient USDT for rewards");
  console.log("   • Verify contract has CELO for gas (if needed)");
  console.log("   • Owner and deployer accounts should have CELO for operations");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
