import { defineConfig } from "@wagmi/cli";
import { etherscan } from "@wagmi/cli/plugins";
import { mainnet } from "wagmi/chains";
import "dotenv/config";

export default defineConfig({
  out: "wagmi/generated.ts",
  plugins: [
    etherscan({
      apiKey: process.env.ETHERSCAN_API_KEY!,
      chainId: mainnet.id,
      contracts: [
        {
          name: "Psyop",
          address: {
            [mainnet.id]: "0x3007083EAA95497cD6B2b809fB97B6A30bdF53D3",
          },
        },
        {
          name: "AirDrop",
          address: {
            [mainnet.id]: "0x2c952eE289BbDB3aEbA329a4c41AE4C836bcc231",
          },
        },
      ],
    }),
  ],
});
