import { retryWithBackOff } from "./concurrency";

export type Transaction = {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  transactionIndex: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  gasUsed: string;
  confirmations: string;
  methodId: string;
  functionName: string;
};

const baseURL = "https://api.etherscan.io/api";

export async function* getAllTransactions({
  address,
  startBlock,
  endBlock,
}: {
  address: string;
  startBlock: number;
  endBlock: number;
}) {
  const searchQuery = new URLSearchParams({
    module: "account",
    action: "txlist",
    address,
    startblock: startBlock.toString(),
    endblock: endBlock.toString(),
    sort: "asc",
    offset: "5000",
    apikey: process.env.ETHERSCAN_API_KEY!,
  });
  let page = 1;
  let json: {
    status: string;
    message: string;
    result: Transaction[];
  } = { status: "0", message: "NOTOK", result: [] };
  do {
    searchQuery.set("page", page.toString());
    const response = await retryWithBackOff(
      () => fetch(`${baseURL}?${searchQuery.toString()}`),
      5,
      1000
    );
    json = await response.json();
    if (json.status !== "1") {
      throw new Error(`Etherscan API returned error: ${json.message}`);
    }
    for (const transaction of json.result) {
      yield transaction;
    }
    page++;
    if (json.result.length < 5000) {
      break;
    }
  } while (json.result.length > 0);
}
