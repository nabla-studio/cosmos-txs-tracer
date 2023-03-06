import { Chain } from "@chain-registry/types";
import { ChakraProvider } from "@chakra-ui/react";
import { Decimal } from "@cosmjs/math";
import { GasPrice } from "@cosmjs/stargate";
import { wallets as keplrWallets } from "@cosmos-kit/keplr";
import { ChainProvider, defaultTheme } from "@cosmos-kit/react";
import { assets, chains } from "chain-registry";
import type { AppProps } from "next/app";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ChakraProvider theme={defaultTheme}>
      <ChainProvider
        // used when testing add-chain
        // chains={chains.filter((chain) => chain.chain_name !== "cosmoshub")}
        // assetLists={assets.filter(
        //   (assets) => assets.chain_name !== "cosmoshub"
        // )}
        chains={chains}
        assetLists={assets}
        wallets={[
          ...keplrWallets,
        ]}
        defaultNameService={"osmosis"}
        signerOptions={{
          signingStargate: (chain: Chain) => {
            switch (chain.chain_name) {
              case "osmosis":
                return {
                  gasPrice: new GasPrice(Decimal.zero(1), "uosmo"),
                };
              default:
                return void 0;
            }
          },
        }}
        logLevel={"INFO"}
        wrappedWithChakra={true}
      >
        <Component {...pageProps} />
      </ChainProvider>
    </ChakraProvider>
  );
}

export default MyApp;