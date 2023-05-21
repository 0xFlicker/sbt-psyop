import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { psyopAddress } from "../wagmi/generated";
import { Psyop, Psyop__factory } from "../typechain-types";
import { TransactionReceipt, TransactionResponse } from "ethers";
import cliProgress from "cli-progress";
import {
  promiseAllWithConcurrency,
  retryWithBackOff,
} from "../utils/concurrency";
import { getAllTransactions } from "../utils/etherscan";

export async function collectPsyopAllowedAddressesOld(
  hre: HardhatRuntimeEnvironment
): Promise<string[]> {
  const { ethers } = hre;
  const multiBar = new cliProgress.MultiBar(
    {},
    cliProgress.Presets.shades_classic
  );
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
  const blockProgress = multiBar.create(endBlock - startBlock, 0, {
    format:
      "{bar} | {percentage}% || {eta_formatted} || {value}/{total} Blocks",
  });
  blockProgress.start(endBlock - startBlock, 0);
  const setAddressToWhiteListFunction = psyop.interface.getFunction(
    "setAddressToWhiteList"
  );
  for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
    blockProgress.increment();
    const block = await ethers.provider.getBlock(blockNumber);
    if (!block) {
      console.error(`Could not fetch block ${blockNumber}`);
      continue;
    }
    if (block.transactions.length === 0) {
      continue;
    }
    const txProgress = multiBar.create(block.transactions.length, 0, {
      format:
        "{bar} | {percentage}% || {eta_formatted} || {value}/{total} Transactions",
    });
    txProgress.start(block.transactions.length, 0);
    const txsForBlock =
      await promiseAllWithConcurrency<TransactionResponse | null>(
        block.transactions.map((transaction) => {
          return () => {
            txProgress.increment();
            return retryWithBackOff(
              () => ethers.provider.getTransaction(transaction),
              100,
              1000
            );
          };
        }),
        2
      );
    txProgress.stop();
    multiBar.remove(txProgress);
    const matchingTxs = txsForBlock.filter((tx) => {
      if (!tx) {
        return false;
      }
      if (tx.to === psyopAddress[1]) {
        return true;
      }
      return false;
    });
    if (matchingTxs.length === 0) {
      continue;
    }
    // get all receipts
    const receiptProgress = multiBar.create(matchingTxs.length, 0, {
      format:
        "{bar} | {percentage}% || {eta_formatted} || {value}/{total} Receipts",
    });
    receiptProgress.start(matchingTxs.length, 0);
    const receipts = await promiseAllWithConcurrency<{
      tx: TransactionResponse;
      receipt: TransactionReceipt | null;
    }>(
      matchingTxs.map((tx) => {
        return async () => {
          receiptProgress.increment();
          const receipt = await retryWithBackOff(
            () => ethers.provider.getTransactionReceipt(tx!.hash),
            100,
            1000
          );
          return { tx: tx!, receipt };
        };
      }),
      2
    );
    receiptProgress.stop();
    multiBar.remove(receiptProgress);

    for (const { tx, receipt } of receipts) {
      if (!receipt) {
        console.error(`Could not fetch receipt for transaction ${tx.hash}`);
        continue;
      }
      if (receipt.status === 1) {
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
  blockProgress.stop();
  return Array.from(allowedAddresses);
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

  for await (const transaction of getAllTransactions({
    startBlock,
    endBlock,
    address: psyopAddress[1],
  })) {
    if (transaction.isError === "0") {
      // okay, this is a transaction to psyopAddress[1], but is it a setAddressToWhiteList transaction?
      const parsedTx = psyop.interface.parseTransaction({
        data: transaction.input,
        value: transaction.value,
      });
      if (!parsedTx) {
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
  return Array.from(allowedAddresses);
}
