import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const FUJI_RPC = process.env.AVAX_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    // Persistent local node started with `npm run node` (fake funds, no faucet).
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    // Avalanche Fuji C-Chain testnet
    fuji: {
      url: FUJI_RPC,
      chainId: 43113,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  // Source-code verification on Snowtrace (Routescan-powered, no real API key needed)
  etherscan: {
    apiKey: {
      avalancheFujiTestnet: process.env.SNOWTRACE_API_KEY ?? "routescan",
    },
    customChains: [
      {
        network: "avalancheFujiTestnet",
        chainId: 43113,
        urls: {
          apiURL: "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan",
          browserURL: "https://testnet.snowtrace.io",
        },
      },
    ],
  },
  // Fallback verifier (no API key); Snowtrace can also surface Sourcify matches.
  sourcify: {
    enabled: true,
  },
};

export default config;
