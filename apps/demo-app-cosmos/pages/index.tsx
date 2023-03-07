import { WalletStatus } from '@cosmos-kit/core';
import { useChain, useWallet } from '@cosmos-kit/react';
import styled from '@emotion/styled';
import { useCallback } from 'react';
import { cosmos, ibc } from 'osmojs';
import { StdFee } from '@cosmjs/amino';
import { useMachine } from '@xstate/react';
import { txTraceMachine, ibcTraceMachine } from '@nabla-studio/txs-tracer-core'
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { toHex } from '@cosmjs/encoding';
import Long from 'long';
import { calculateFee } from '@cosmjs/stargate';

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
	const { username, address, connect, disconnect, getRpcEndpoint, getSigningStargateClient } = useChain("osmosis");
	const { address: cosmosAddress, connect: connectCosmos } = useChain("cosmoshub");
  const { status: globalStatus } = useWallet();

	const sendToken = useCallback(async () => {
		const { send } = cosmos.bank.v1beta1.MessageComposer.withTypeUrl;

		const stargateClient = await getSigningStargateClient();

		console.log(stargateClient);

		const msg = send({
			amount: [
			{
					denom: 'uosmo',
					amount: '1000'
			}
			],
			toAddress: address,
			fromAddress: address
		});

		const fee: StdFee = {
				amount: [
				{
						denom: 'uosmo',
						amount: '864'
				}
				],
				gas: '86364'
		};

		const responseSign = await stargateClient.sign(address, [msg], fee, '');

		const txBytes = TxRaw.encode(responseSign).finish();

		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		const broadcasted = await stargateClient.forceGetTmClient().broadcastTxSync({ tx: txBytes });

		const transactionId = toHex(broadcasted.hash).toUpperCase();
		console.log(transactionId);
		
		const rpc = await getRpcEndpoint();

		sendMachine({ type: 'TRACE', data: { query: `tx.hash='${transactionId}'`, websocketUrl: rpc.replace('https', 'wss') } })
	}, [getSigningStargateClient, getRpcEndpoint, sendMachine, address])

	console.log(state.value.toString(), state.context.txs)

	const sendIBCToken = useCallback(async () => {
		const {
			transfer
	} = ibc.applications.transfer.v1.MessageComposer.withTypeUrl

		const stargateClient = await getSigningStargateClient();

		console.log(stargateClient);

		const msg = transfer({
			sourcePort: 'transfer',
			sourceChannel: 'channel-0',
			token: {
				denom: 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
				amount: '10'
			},
			sender: address,
			receiver: cosmosAddress,
			timeoutTimestamp: Long.fromNumber(Math.floor(new Date().getTime() / 1000) + 600).multiply(1_000_000_000)
		});

		const gasEstimation = await stargateClient.simulate(address, [msg], '');

		const fee: StdFee = {
			amount: [
			{
					denom: 'uosmo',
					amount: '864'
			}
			],
			gas: '86364'
	};

		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		/* const fee: StdFee = calculateFee(Math.round(gasEstimation * 1.3), stargateClient.gasPrice); */

		const responseSign = await stargateClient.sign(address, [msg], fee, '');

		const txBytes = TxRaw.encode(responseSign).finish();

		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		const broadcasted = await stargateClient.forceGetTmClient().broadcastTxSync({ tx: txBytes });

		const transactionId = toHex(broadcasted.hash).toUpperCase();
		console.log(transactionId);
		
		const rpc = await getRpcEndpoint();

		sendIBCMachine({ type: 'TRACE', data: { websocketUrl: rpc.replace('https', 'wss'), query: `tx.hash='${transactionId}'` } })
	}, [getSigningStargateClient, address, cosmosAddress, getRpcEndpoint, sendIBCMachine])

	console.log(ibcState.children.sendPacketTrace)

	/*
	 * Replace the elements below with your own.
	 *
	 * Note: The corresponding styles are in the ./index.@emotion/styled file.
	 */
	return (
		<StyledPage>
			<div className="wrapper">
				<h3>SEND: {state.value.toString()}</h3>
				<h3>IBC: {ibcState.value.toString()} loading: {ibcState.context.loading ? 'true' : 'false'} step: {ibcState.context.currentStep} errorCode: {ibcState.context.errorCode}</h3>
				<button onClick={async () => {
					await connect();
					await connectCosmos();
				}}>Connect</button>
				<div>
				{globalStatus === WalletStatus.Connected && <button onClick={sendToken}>Send</button>}
				</div>
				<div>
				{globalStatus === WalletStatus.Connected && <button onClick={sendIBCToken}>Send IBC</button>}
				</div>
			</div>
		</StyledPage>
	);
}

export default Index;
