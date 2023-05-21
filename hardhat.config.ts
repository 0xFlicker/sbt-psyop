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
import { psyopABI, airDropABI } from "./wagmi/generated";
import { collectPsyopAllowedAddresses } from "./script/collectPsyopAllowedAddresses";
import {
  collectPsyopAirdropAddresses,
  statsOnAirdrop,
} from "./script/collectPsyopAirdropAddresses";
import { v4 as uuidv4 } from "uuid";
import os from "os";
import path from "path";

const extraAbi = [
  {
    abi: psyopABI,
    filename: "Psyop.json",
  },
  {
    abi: airDropABI,
    filename: "AirDrop.json",
  },
];
task("wagmi:typechain", "generate Psyop typechain types", async (_, hre) => {
  // write ABI to tmp file
  const uuid = uuidv4();
  const tmpDir = path.join(os.tmpdir(), `abi-${uuid}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const abiFiles = await Promise.all(
    extraAbi.map(async (abi) => {
      const filename = path.join(tmpDir, abi.filename);
      await fs.promises.writeFile(filename, JSON.stringify(abi.abi));
      return filename;
    })
  );
  const result = await runTypeChain({
    cwd: hre.config.paths.root,
    filesToProcess: abiFiles,
    allFiles: abiFiles,
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

task("psyop:presale", "collect addresses", async (_, hre) => {
  const { ethers } = hre;
  const presaleAddresses = await collectPsyopAirdropAddresses(hre);
  const csv: [string, string][] = [];
  const stats = statsOnAirdrop(presaleAddresses);
  console.log(`Total addresses: ${stats.count}`);
  console.log(
    `Total amount: ${Number(ethers.formatUnits(stats.total, 18)).toFixed(0)}`
  );
  console.log(
    `Min amount: ${Number(ethers.formatUnits(stats.min, 18)).toFixed(0)}`
  );
  console.log(
    `Max amount: ${Number(ethers.formatUnits(stats.max, 18)).toFixed(0)}`
  );
  console.log(
    `Average amount: ${Number(ethers.formatUnits(stats.avg, 18)).toFixed(0)}`
  );
  console.log(
    `Median amount: ${Number(ethers.formatUnits(stats.median, 18)).toFixed(0)}`
  );

  for (const [address, amount] of presaleAddresses) {
    // const removedDecimal = amount / 10n ** 18n;
    // divide by 10**18 to get the number of tokens, but keep 2 decimal places
    const formattedNumber = ethers.formatUnits(amount, 18);
    csv.push([address, formattedNumber]);
  }
  fs.writeFileSync("presale.csv", csv.map((row) => row.join(",")).join("\n"));
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
