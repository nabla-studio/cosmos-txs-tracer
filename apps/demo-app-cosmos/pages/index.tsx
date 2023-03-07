import { WalletStatus } from '@cosmos-kit/core';
import { useChain, useWallet } from '@cosmos-kit/react';
import styled from '@emotion/styled';
import { useCallback } from 'react';
import { cosmos } from 'osmojs';
import { StdFee } from '@cosmjs/amino';
import { useMachine } from '@xstate/react';
import { txTraceMachine } from '@nabla-studio/txs-tracer-core'
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { toHex } from '@cosmjs/encoding';

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
	const { username, address, connect, disconnect, getRpcEndpoint, getSigningStargateClient } = useChain("osmosis");
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

	/*
	 * Replace the elements below with your own.
	 *
	 * Note: The corresponding styles are in the ./index.@emotion/styled file.
	 */
	return (
		<StyledPage>
			<div className="wrapper">
				<h3>{state.value.toString()}</h3>
				<button onClick={() => connect()}>Connect</button>
				{globalStatus === WalletStatus.Connected && <button onClick={sendToken}>Send</button>}
			</div>
		</StyledPage>
	);
}

export default Index;
