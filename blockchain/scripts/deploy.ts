import { ethers, network } from "hardhat";

/*
 * Deploys the TournamentScores contract to the selected Hardhat network.
 * - Logs the network, deployer address and balance.
 * - Deploys the contract and prints its address (+ the CHAIN_CONTRACT_ADDRESS
 *   env line to paste into the backend, and the explorer URL on fuji).
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Network : ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance : ${ethers.formatEther(balance)} AVAX`);

  const factory = await ethers.getContractFactory("TournamentScores");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\nTournamentScores deployed at:", address);
  console.log("\nAdd this to your backend .env:");
  console.log(`CHAIN_CONTRACT_ADDRESS=${address}`);
  if (network.name === "fuji") {
    console.log(`Explorer: https://testnet.snowtrace.io/address/${address}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
