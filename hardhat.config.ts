import fs from "fs";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomicfoundation/hardhat-foundry";
import "hardhat-gas-reporter";
import "hardhat-deploy";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomiclabs/hardhat-etherscan";
import "dotenv/config";
import { envEtherscanApiKey, envMnemonic, envRpc } from "./utils/env";
import { HardhatUserConfig, task } from "hardhat/config";
import { runTypeChain, glob } from "typechain";
import { psyopABI } from "./wagmi/generated";
import { collectPsyopAllowedAddresses } from "./script/collectPsyopAllowedAddresses";

import os from "os";
import path from "path";

task("psyop:typechain", "generate Psyop typechain types", async (_, hre) => {
  // write ABI to tmp file
  const tmpDir = path.join(os.tmpdir(), "psyop-abi");
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, "psyop.json");
  fs.writeFileSync(tmpFile, JSON.stringify(psyopABI));
  const result = await runTypeChain({
    cwd: hre.config.paths.root,
    filesToProcess: [tmpFile],
    allFiles: [tmpFile],
    outDir: "typechain-types",
    target: "ethers-v6",
  });
  console.log(result);
  fs.rmSync(tmpDir, { recursive: true });
});

task("psyop:allowedAddresses", "collect allowed addresses", async (_, hre) => {
  const allowedAddresses = await collectPsyopAllowedAddresses(hre);
  console.log("Allowed addresses:");
  console.log(allowedAddresses.join("\n"));
});

export default {
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 20000,
      },
    },
  },
  gasReporter: {
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  namedAccounts: {
    deployer: 0,
  },
  networks: {
    goerli: {
      url: envRpc("goerli"),
      accounts: { mnemonic: envMnemonic("goerli") },
    },
    mainnet: {
      url: envRpc("mainnet"),
      accounts: { mnemonic: envMnemonic("mainnet") },
    },
  },
  etherscan: {
    apiKey: {
      mainnet: envEtherscanApiKey("mainnet"),
      goerli: envEtherscanApiKey("goerli"),
    },
  },
  paths: {
    tests: "./hh-test",
    sources: "./src",
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
} as HardhatUserConfig;
