function environmentFetcher(envName: string) {
  return (networkName: string): string => {
    networkName = networkName.toUpperCase();
    if (!process.env[`${networkName}_${envName}`] && !process.env[envName]) {
      throw new Error(`Missing ${networkName}_${envName}`);
    }
    return (
      process.env[`${networkName}_${envName}`] ??
      (process.env[envName] as string)
    );
  };
}

export const envDeploymentKeyFile = environmentFetcher("DEPLOYMENT_KEY_FILE");
export const envDeploymentKeyPassword = environmentFetcher(
  "DEPLOYMENT_KEY_PASSWORD"
);
export const envBaseURI = environmentFetcher("BASE_URI");
export const envTestName = environmentFetcher("TEST_NAME");
export const envTestSymbol = environmentFetcher("TEST_SYMBOL");
export const envWrappedTokenAddress = environmentFetcher("WRAPPED_TOKEN");
export const envWrappedTokenName = environmentFetcher("WRAPPED_TOKEN_NAME");
export const envWrappedTokenSymbol = environmentFetcher("WRAPPED_TOKEN_SYMBOL");
export const envWrappedTokenRendererAddress = environmentFetcher(
  "WRAPPED_TOKEN_RENDERER"
);
export const envRpc = environmentFetcher("RPC");
export const envEtherscanApiKey = environmentFetcher("ETHERSCAN_API_KEY");
export const envMnemonic = environmentFetcher("MNEMONIC");
