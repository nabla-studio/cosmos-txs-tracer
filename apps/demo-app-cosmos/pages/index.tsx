import { WalletStatus } from '@cosmos-kit/core';
import { useChain, useWallet } from '@cosmos-kit/react';
import styled from '@emotion/styled';
import { useCallback } from 'react';
import { cosmos, ibc } from 'osmojs';
import { StdFee } from '@cosmjs/amino';
import { useMachine } from '@xstate/react';
import {
	txTraceMachine,
	ibcTraceMachine,
	crossSwapTraceMachine,
} from '@nabla-studio/txs-tracer-core';
import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { toHex } from '@cosmjs/encoding';
import Long from 'long';

const StyledPage = styled.div`
	.page {
	}
`;

export function Index() {
	const [state, sendMachine] = useMachine(txTraceMachine, {
		context: {
			...txTraceMachine.context,
			subscribeTimeout: 60_000,
		},
	});

	const [ibcState, sendIBCMachine] = useMachine(ibcTraceMachine, {
		context: {
			...ibcTraceMachine.context,
			subscribeTimeout: 60_000,
		},
	});

	const [crossSwapState, sendCrossSwapMachine] = useMachine(
		crossSwapTraceMachine,
		{
			context: {
				...ibcTraceMachine.context,
				subscribeTimeout: 60_000,
			},
		},
	);

	const {
		address,
		connect,
		getRpcEndpoint,
		sign,
		getSigningStargateClient,
	} = useChain('osmosis');
	const {
		address: junoAddress,
		connect: connectJuno,
		sign: signJuno,
		getRpcEndpoint: getJunoRpcEndpoint,
		getSigningStargateClient: getJunoSigningStargateClient,
	} = useChain('juno');
	const {
		address: cosmosAddress,
		connect: connectCosmos,
		sign: signCosmos,
		getRpcEndpoint: getCosmosRpcEndpoint,
		getSigningStargateClient: getCosmosSigningStargateClient,
	} = useChain('cosmoshub');
	const {
		address: akashAddress
	} = useChain('akash');
	const { status: globalStatus } = useWallet();

	const sendToken = useCallback(async () => {
		const { send } = cosmos.bank.v1beta1.MessageComposer.withTypeUrl;

		const stargateClient = await getSigningStargateClient();

		const msg = send({
			amount: [
				{
					denom: 'uosmo',
					amount: '1000',
				},
			],
			toAddress: address,
			fromAddress: address,
		});

		const responseSign = await sign([msg]);

		const txBytes = TxRaw.encode(responseSign).finish();

		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		const broadcasted = await stargateClient.forceGetTmClient().broadcastTxSync({ tx: txBytes });

		const transactionId = toHex(broadcasted.hash).toUpperCase();

		const rpc = await getRpcEndpoint();

		sendMachine({
			type: 'TRACE',
			data: {
				query: `tx.hash='${transactionId}'`,
				websocketUrl: rpc.toString().replace('https', 'wss'),
			},
		});
	}, [getSigningStargateClient, address, sign, getRpcEndpoint, sendMachine]);

	const sendIBCToken = useCallback(async () => {
		const { transfer } = ibc.applications.transfer.v1.MessageComposer.withTypeUrl;

		const stargateClient = await getSigningStargateClient();

		const msg = transfer({
			sourcePort: 'transfer',
			/**
			 * Channel 42 from osmo to juno
			 */
			sourceChannel: 'channel-42',
			token: {
				denom: 'uosmo',
				amount: '1',
			},
			sender: address,
			receiver: junoAddress,
			timeoutTimestamp: Long.fromNumber(
				Math.floor(new Date().getTime() / 1000) + 600,
			).multiply(1_000_000_000),
			memo: '',
		});

		const responseSign = await sign([msg]);

		const txBytes = TxRaw.encode(responseSign).finish();

		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		const broadcasted = await stargateClient.forceGetTmClient().broadcastTxSync({ tx: txBytes });

		const transactionId = toHex(broadcasted.hash).toUpperCase();

		const rpc = await getRpcEndpoint();
		const junoRPC = await getJunoRpcEndpoint();

		sendIBCMachine({
			type: 'TRACE',
			data: {
				websocketUrl: rpc.toString().replace('https', 'wss'),
				dstWebsocketUrl: junoRPC.toString().replace('https', 'wss'),
				query: `tx.hash='${transactionId}'`,
				srcChannel: 'channel-42',
				dstChannel: 'channel-0',
			},
		});
	}, [getSigningStargateClient, address, junoAddress, sign, getRpcEndpoint, getJunoRpcEndpoint, sendIBCMachine]);

	const sendIBCSwapToken = useCallback(async () => {
		const { transfer } = ibc.applications.transfer.v1.MessageComposer.withTypeUrl;
		const stargateClient = await getJunoSigningStargateClient();

		const isMatch = ['complete', 'error'].some(
			crossSwapState.matches
		)

		console.log(isMatch);

		if (isMatch) {
			sendCrossSwapMachine({
				type: 'RESET'
			})
		}

		/**
		 * Native to non-native
		 */
		/* const memo = {
			wasm: {
				contract: 'osmo1uwk8xc6q0s6t5qcpr6rht3sczu6du83xq8pwxjua0hfj5hzcnh3sqxwvxs',
				msg: {
					osmosis_swap: {
						output_denom: 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2', //// ATOM on osmosis
						slippage: { twap: { slippage_percentage: '20', window_seconds: 10 } },
						// receiver: junoAddress,
						receiver: cosmosAddress,
						on_failed_delivery: {
							local_recovery_addr: address,
						},
						"next_memo": {
							"forward": {
									"receiver": junoAddress,  // Final receiver
									"port": "transfer",
									"channel": "channel-207"  // Juno's channel on gaia
							}
					},
					},
				},
			},
		}; */

		/**
		 * Non-native to native
		 */
		/* const memo = {
			forward: {
				"receiver": "osmo1uwk8xc6q0s6t5qcpr6rht3sczu6du83xq8pwxjua0hfj5hzcnh3sqxwvxs",  // XCS contract
        "port": "transfer",
        "channel": "channel-141",  // Osmosis channel on gaia
				"next": {
					wasm: {
						contract: 'osmo1uwk8xc6q0s6t5qcpr6rht3sczu6du83xq8pwxjua0hfj5hzcnh3sqxwvxs',
						msg: {
							osmosis_swap: {
								output_denom: 'ibc/46B44899322F3CD854D2D46DEEF881958467CDD4B3B10086DA49296BBED94BED', // Juno on osmosis
								slippage: { twap: { slippage_percentage: '20', window_seconds: 10 } },
								receiver: junoAddress,
								on_failed_delivery: {
									local_recovery_addr: address,
								},
							},
						},
					},
				}
			}
		}; */
		/**
		 * Non-native to non-native
		 */
		const memo = {
			forward: {
				"receiver": "osmo1uwk8xc6q0s6t5qcpr6rht3sczu6du83xq8pwxjua0hfj5hzcnh3sqxwvxs",  // XCS contract
        "port": "transfer",
        "channel": "channel-141",  // Osmosis channel on gaia
				"next": {
					wasm: {
						contract: 'osmo1uwk8xc6q0s6t5qcpr6rht3sczu6du83xq8pwxjua0hfj5hzcnh3sqxwvxs',
						msg: {
							osmosis_swap: {
								output_denom: 'ibc/1480B8FD20AD5FCAE81EA87584D269547DD4D436843C1D20F15E00EB64743EF4', // Akash on osmosis
								slippage: { twap: { slippage_percentage: '20', window_seconds: 10 } },
								receiver: akashAddress, // Akash address
								"next_memo": {
									"forward": {
										"receiver": junoAddress,  // Final receiver
										"port": "transfer",
										"channel": "channel-35"  // Juno's channel on Akash
									}
							},
								on_failed_delivery: {
									local_recovery_addr: address,
								},
							},
						},
					},
				}
			}
		};

		/**
		 * Native to non-native
		 */
		/* const msg = transfer({
			sourcePort: 'transfer',
			// Channel 0 from juno to osmo
			sourceChannel: 'channel-0',
			token: {
				denom: 'ujuno',
				amount: '100000',
			},
			sender: junoAddress,
			receiver: 'osmo1uwk8xc6q0s6t5qcpr6rht3sczu6du83xq8pwxjua0hfj5hzcnh3sqxwvxs',
			timeoutTimestamp: Long.fromNumber(
				Math.floor(new Date().getTime() / 1000) + 600,
			).multiply(1_000_000_000),
			memo: JSON.stringify(memo)
		}); */

		/**
		 * Non-native to native
		 * 
		 * Swap Atom to JUNO
		 */
		const msg = transfer({
			sourcePort: 'transfer',
			// Channel 1 from juno to atom
			sourceChannel: 'channel-1',
			token: {
				denom: 'ibc/C4CFF46FD6DE35CA4CF4CE031E643C8FDC9BA4B99AE598E9B0ED98FE3A2319F9', // Atom on Juno
				amount: '1',
			},
			sender: junoAddress,
			receiver: cosmosAddress,
			timeoutTimestamp: Long.fromNumber(
				Math.floor(new Date().getTime() / 1000) + 600,
			).multiply(1_000_000_000),
			memo: JSON.stringify(memo)
		});

		const responseSign = await signJuno([msg]);

		const txBytes = TxRaw.encode(responseSign).finish();

		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		const broadcasted = await stargateClient.forceGetTmClient().broadcastTxSync({ tx: txBytes });

		const transactionId = toHex(broadcasted.hash).toUpperCase();

		const rpc = await getJunoRpcEndpoint();
		const osmosisRPC = await getRpcEndpoint();

		sendCrossSwapMachine({
			type: 'TRACE',
			data: {
				websocketUrl: 'https://rpc-juno-ia.cosmosia.notional.ventures'.replace('https', 'wss'),
				dstWebsocketUrl: 'https://rpc.cosmoshub.strange.love'.replace('https', 'wss'),
				executorWebsocketUrl: 'https://rpc.osmosis.zone'.replace('https', 'wss'),
				query: `tx.hash='${transactionId}'`,
				/* srcChannel: 'channel-0', // Channels for Juno to osmosis (Native to native)
				dstChannel: 'channel-42', */
				srcChannel: 'channel-1', // Channels for Juno to CosmosHub (Non-native to native) and (Non-native to non-native)
				dstChannel: 'channel-207',
				txHash: transactionId,
			},
		});
	}, [getJunoSigningStargateClient, crossSwapState.matches, cosmosAddress, address, junoAddress, signJuno, getJunoRpcEndpoint, getRpcEndpoint, sendCrossSwapMachine]);

	/*
	 * Replace the elements below with your own.
	 *
	 * Note: The corresponding styles are in the ./index.@emotion/styled file.
	 */
	return (
		<StyledPage>
			<div className="wrapper">
				<h3>SEND: {state.value.toString()}</h3>
				<h3>
					IBC: {ibcState.value.toString()} loading:{' '}
					{ibcState.context.loading ? 'true' : 'false'} step:{' '}
					{ibcState.context.currentStep} errorCode: {ibcState.context.errorCode}
				</h3>
				<h3>
					SWAP: {crossSwapState.value.toString()} loading:{' '}
					{crossSwapState.context.loading ? 'true' : 'false'} step:{' '}
					{crossSwapState.context.currentStep} errorCode:{' '}
					{crossSwapState.context.errorCode}
				</h3>
				<button
					onClick={async () => {
						await connect();
						await connectJuno();
						await connectCosmos();
					}}>
					Connect
				</button>
				<div>
					{globalStatus === WalletStatus.Connected && (
						<button onClick={sendToken}>Send</button>
					)}
				</div>
				<div>
					{globalStatus === WalletStatus.Connected && (
						<button onClick={sendIBCToken}>Send IBC</button>
					)}
				</div>
				<div>
					{globalStatus === WalletStatus.Connected && (
						<button onClick={sendIBCSwapToken}>Send IBC Swap</button>
					)}
				</div>
			</div>
		</StyledPage>
	);
}

export default Index;
