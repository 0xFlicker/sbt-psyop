import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { psyopAddress } from "../wagmi/generated";
import { Psyop, Psyop__factory } from "../typechain-types";
import { TransactionReceipt, TransactionResponse } from "ethers";

export async function promiseAllWithConcurrency<T>(
  promiseFactory: (index: number) => Promise<T>,
  count: number,
  concurrency: number
): Promise<T[]> {
  if (concurrency <= 0) throw new Error("Concurrency must be greater than 0");

  const results: T[] = new Array(count);
  const promises: Promise<void>[] = [];

  let index = 0;

  const executor = async () => {
    while (index < count) {
      const currentIndex = index++;
      promises.push(
        promiseFactory(currentIndex)
          .then((result) => {
            results[currentIndex] = result;
          })
          .catch((err) => {
            console.error(`Error in promise number ${currentIndex}:`, err);
            throw err; // rethrow the error for outer promise
          })
      );
      if (promises.length >= concurrency) {
        await Promise.race(promises); // Wait for any promise to be fulfilled or rejected.
        promises.splice(
          promises.findIndex((promise) => promise === Promise.race(promises)),
          1
        );
      }
    }
  };

  const executors: Promise<void>[] = [];
  for (let i = 0; i < concurrency && i < count; i++) {
    executors.push(executor());
  }

  await Promise.all(executors); // run executors
  await Promise.all(promises); // wait for all promises to finish
  return results;
}

export async function collectPsyopAllowedAddresses(
  hre: HardhatRuntimeEnvironment
): Promise<string[]> {
  const { ethers } = hre;
  const psyop = Psyop__factory.connect(psyopAddress[1], ethers.provider);
  // iterate over all blocks starting with 17289896 and look for setAddressToWhiteList send to psyopAddress[1]
  // extract the address set

  // NOTE: PSYOP constructor explicitly sets these two addresses as allowed
  // we include them here to see if they end up being removed later
  const allowedAddresses: Set<string> = new Set([
    "0x91364516D3CAD16E1666261dbdbb39c881Dbe9eE",
    "0xFA080F371f2B9986dFD0A692DA4da343178233D0",
  ]);
  const startBlock = 17289896;
  const endBlock = await ethers.provider.getBlockNumber();
  const setAddressToWhiteListFunction = psyop.interface.getFunction(
    "setAddressToWhiteList"
  );
  for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
    const block = await ethers.provider.getBlock(blockNumber);
    if (!block) {
      console.error(`Could not fetch block ${blockNumber}`);
      continue;
    }
    const txsForBlock = await promiseAllWithConcurrency<{
      receipt: TransactionReceipt | null;
      tx: TransactionResponse | null;
    }>(
      async (index) => {
        const [receipt, tx] = await Promise.all([
          ethers.provider.getTransactionReceipt(block.transactions[index]),
          ethers.provider.getTransaction(block.transactions[index]),
        ]);
        return {
          receipt,
          tx,
        };
      },
      block.transactions.length,
      10
    );
    for (const { tx, receipt } of txsForBlock) {
      if (!tx) {
        console.error(`Could not fetch transaction ${tx.hash}`);
        continue;
      }
      if (!receipt) {
        console.error(`Could not fetch receipt for transaction ${tx.hash}`);
        continue;
      }
      if (tx.to === psyopAddress[1] && receipt.status === 1) {
        // okay, this is a transaction to psyopAddress[1], but is it a setAddressToWhiteList transaction?
        const parsedTx = psyop.interface.parseTransaction({
          data: tx.data,
          value: tx.value,
        });
        if (!parsedTx) {
          console.error(`Could not parse transaction ${tx.hash}`);
          continue;
        }
        if (
          parsedTx.name === setAddressToWhiteListFunction.name &&
          parsedTx.args.length === 2
        ) {
          // okay, this is a setAddressToWhiteList transaction, extract the address
          const address: string = parsedTx.args[0];
          const allowed: boolean = parsedTx.args[1];
          if (allowed) {
            allowedAddresses.add(address);
          } else {
            allowedAddresses.delete(address);
          }
        }
      }
    }
  }
  return Array.from(allowedAddresses);
}
