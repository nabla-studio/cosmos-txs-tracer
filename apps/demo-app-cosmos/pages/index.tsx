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
		connect: connectCosmos,
		sign: signJuno,
		getRpcEndpoint: getJunoRpcEndpoint,
		getSigningStargateClient: getJunoSigningStargateClient,
	} = useChain('juno');
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
				websocketUrl: rpc.replace('https', 'wss'),
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
				websocketUrl: rpc.replace('https', 'wss'),
				dstWebsocketUrl: junoRPC.replace('https', 'wss'),
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

		const memo = {
			wasm: {
				contract: 'osmo195stc2anmc6d9y6z7ms3u3pwskv5c8aql498r945pdw5axxe9xsqn76fs6',
				msg: {
					osmosis_swap: {
						output_denom: 'uosmo',
						slippage: { twap: { slippage_percentage: '20', window_seconds: 10 } },
						receiver: junoAddress,
						on_failed_delivery: {
							local_recovery_addr: address,
						},
					},
				},
			},
		};

		const msg = transfer({
			sourcePort: 'transfer',
			/**
			 * Channel 0 from juno to osmo
			 */
			sourceChannel: 'channel-0',
			token: {
				denom: 'ujuno',
				amount: '100000',
			},
			sender: junoAddress,
			receiver: 'osmo195stc2anmc6d9y6z7ms3u3pwskv5c8aql498r945pdw5axxe9xsqn76fs6',
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
				websocketUrl: 'https://rpc-juno.itastakers.com'.replace('https', 'wss'),
				dstWebsocketUrl: 'https://rpc.osmosis.zone'.replace('https', 'wss'),
				query: `tx.hash='${transactionId}'`,
				srcChannel: 'channel-0',
				dstChannel: 'channel-42',
				txHash: transactionId,
			},
		});
	}, [getJunoSigningStargateClient, crossSwapState.matches, junoAddress, address, signJuno, getJunoRpcEndpoint, getRpcEndpoint, sendCrossSwapMachine]);

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
