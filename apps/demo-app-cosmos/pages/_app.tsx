import { Chain } from "@chain-registry/types";
import { ChakraProvider } from "@chakra-ui/react";
import { Decimal } from "@cosmjs/math";
import { Registry } from "@cosmjs/proto-signing";
import { AminoTypes, GasPrice } from "@cosmjs/stargate";
import { wallets as keplrWallets } from "@cosmos-kit/keplr";
import { ChainProvider, defaultTheme } from "@cosmos-kit/react";
import { assets, chains } from "chain-registry";
import type { AppProps } from "next/app";
import {
	cosmosAminoConverters,
	cosmosProtoRegistry,
	cosmwasmAminoConverters,
	cosmwasmProtoRegistry,
	ibcAminoConverters,
	ibcProtoRegistry,
	osmosisAminoConverters,
	osmosisProtoRegistry,
} from 'osmojs';

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
        endpointOptions={{
          'juno': {
            rpc: ['https://rpc-juno.itastakers.com']
          }
        }}
        walletConnectOptions={{
          signClient: {
            projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ?? '',
            relayUrl: process.env.NEXT_PUBLIC_WALLET_CONNECT_RELAY_URL,
            metadata: {
              name: process.env.NEXT_PUBLIC_WALLET_CONNECT_METADATA_NAME ?? '',
              description:
                process.env.NEXT_PUBLIC_WALLET_CONNECT_METADATA_DESCRIPTION ?? '',
              url: process.env.NEXT_PUBLIC_WALLET_CONNECT_METADATA_URL ?? '',
              icons: [process.env.NEXT_PUBLIC_WALLET_CONNECT_METADATA_ICON ?? ''],
            },
          },
        }}
        signerOptions={{
          signingStargate: (chain: Chain) => {
            let gasPrice: GasPrice | undefined = undefined;

            if (chain.fees && chain.fees.fee_tokens.length > 0) {
              gasPrice = new GasPrice(
                Decimal.zero(1),
                chain.fees.fee_tokens[0].denom,
              );
            }

            return {
              gasPrice,
              registry: new Registry([
                ...ibcProtoRegistry,
                ...cosmosProtoRegistry,
                ...osmosisProtoRegistry,
                ...cosmwasmProtoRegistry,
              ]),
              aminoTypes: new AminoTypes({
                ...ibcAminoConverters,
                ...cosmosAminoConverters,
                ...osmosisAminoConverters,
                ...cosmwasmAminoConverters,
              }),
            };
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