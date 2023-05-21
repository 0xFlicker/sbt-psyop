import type { HardhatRuntimeEnvironment } from "hardhat/types";
import type { TransactionReceipt, TransactionResponse } from "ethers";
import { promiseAllWithConcurrency } from "../utils/concurrency";
import { AirDrop__factory } from "../typechain-types";
import { psyopAddress, airDropAddress } from "../wagmi/generated";
import { getAllTransactions } from "../utils/etherscan";

// export async function collectPsyopAirdropAddressesOld(
//   hre: HardhatRuntimeEnvironment
// ): Promise<Map<string, bigint>> {
//   const { ethers } = hre;
//   const airdropReceivedAddresses = new Map<string, BigInt>();
//   const airdrop = AirDrop__factory.connect(airDropAddress[1], ethers.provider);
//   const startBlock = 17289896;
//   const endBlock = await ethers.provider.getBlockNumber();
//   console.log(`Checking blocks ${startBlock} to ${endBlock}`);
//   for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
//     const block = await ethers.provider.getBlock(blockNumber);
//     if (!block) {
//       console.error(`Could not fetch block ${blockNumber}`);
//       continue;
//     }
//     const txsForBlock = await promiseAllWithConcurrency<{
//       receipt: TransactionReceipt | null;
//       tx: TransactionResponse | null;
//     }>(
//       async (index) => {
//         const [receipt, tx] = await Promise.all([
//           ethers.provider.getTransactionReceipt(block.transactions[index]),
//           ethers.provider.getTransaction(block.transactions[index]),
//         ]);
//         return {
//           receipt,
//           tx,
//         };
//       },
//       block.transactions.length,
//       10
//     );
//     console.log(`Checking block ${blockNumber} of ${endBlock}`);
//     for (const { tx, receipt } of txsForBlock) {
//       if (!tx) {
//         console.error(`Could not fetch transaction`);
//         continue;
//       }
//       if (!receipt) {
//         console.error(`Could not fetch receipt for transaction ${tx.hash}`);
//         continue;
//       }
//       if (tx.to === airDropAddress[1] && receipt.status === 1) {
//         // okay, this is a transaction to psyopAddress[1], but is it a setAddressToWhiteList transaction?
//         const parsedTx = airdrop.interface.parseTransaction({
//           data: tx.data,
//           value: tx.value,
//         });
//         if (!parsedTx) {
//           console.error(`Could not parse transaction ${tx.hash}`);
//           continue;
//         }
//         if (parsedTx.name === "airdropERC20") {
//           console.log(`Found airdropERC20 transaction ${tx.hash}`);
//           const [tokenAddress, recipients, amounts] = parsedTx.args;
//           if (tokenAddress !== psyopAddress[1]) {
//             continue;
//           }
//           for (let i = 0; i < recipients.length; i++) {
//             const recipient = recipients[i];
//             const amount = amounts[i];
//             if (airdropReceivedAddresses.has(recipient)) {
//               airdropReceivedAddresses.set(
//                 recipient,
//                 airdropReceivedAddresses.get(recipient)! + amount
//               );
//             } else {
//               airdropReceivedAddresses.set(recipient, amount);
//             }
//           }
//         }
//       }
//     }
//   }
//   return airdropReceivedAddresses;
// }

export async function collectPsyopAirdropAddresses(
  hre: HardhatRuntimeEnvironment
): Promise<Map<string, bigint>> {
  const { ethers } = hre;
  const airdropReceivedAddresses = new Map<string, bigint>();
  const airdrop = AirDrop__factory.connect(airDropAddress[1], ethers.provider);
  const startBlock = 17289896;
  const endBlock = await ethers.provider.getBlockNumber();

  for await (const transaction of getAllTransactions({
    startBlock,
    endBlock,
    address: airDropAddress[1],
  })) {
    if (
      transaction.isError === "0" &&
      transaction.to.toLowerCase() === airDropAddress[1].toLowerCase()
    ) {
      console.log(`Found airdropERC20 transaction ${transaction.hash}`);
      // okay, this is a transaction to psyopAddress[1], but is it a setAddressToWhiteList transaction?
      const parsedTx = airdrop.interface.parseTransaction({
        data: transaction.input,
        value: transaction.value,
      });
      if (!parsedTx) {
        console.error(`Could not parse transaction ${transaction.hash}`);
        continue;
      }
      if (
        parsedTx.name === airdrop.interface.getFunction("airdropERC20").name
      ) {
        const [tokenAddress, recipients, amounts] = parsedTx.args;
        if (tokenAddress !== psyopAddress[1]) {
          continue;
        }
        for (let i = 0; i < recipients.length; i++) {
          const recipient = recipients[i];
          const amount = amounts[i];
          if (airdropReceivedAddresses.has(recipient)) {
            airdropReceivedAddresses.set(
              recipient,
              airdropReceivedAddresses.get(recipient)! + amount
            );
          } else {
            airdropReceivedAddresses.set(recipient, amount);
          }
        }
      }
    }
  }
  return airdropReceivedAddresses;
}

export function statsOnAirdrop(airdropAddresses: Map<string, bigint>): {
  total: bigint;
  count: number;
  min: bigint;
  max: bigint;
  avg: bigint;
  median: bigint;
} {
  let min = BigInt(2) ** BigInt(256);
  let max = BigInt(0);
  let total = BigInt(0);
  const amounts = Array.from(airdropAddresses.values()).sort();
  for (const amount of amounts) {
    if (amount < min) {
      min = amount;
    }
    if (amount > max) {
      max = amount;
    }
    total += amount;
  }
  const avg = total / BigInt(amounts.length);
  const median = amounts[Math.floor(amounts.length / 2)];
  return {
    count: amounts.length,
    total,
    min,
    max,
    avg,
    median,
  };
}
