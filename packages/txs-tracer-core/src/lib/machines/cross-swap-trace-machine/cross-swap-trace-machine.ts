import { DoneInvokeEvent, assign, createMachine, raise, sendTo } from 'xstate';
import {
	CrossSwapTraceEvents,
	IBCTraceAckEventPayload,
	CrossSwapTraceContext,
	IBCTraceDataResponse,
	IBCTraceFinalState,
	CrossSwapTraceFinalState,
	SwapContractResponseRaw,
	SwapContractResponse,
	TxTraceFinalState,
	TxTraceDataResponse,
} from '../../types';
import { ibcTraceMachine } from '../ibc-trace-machine';
import { choose } from 'xstate/lib/actions';
import { IndexedTx } from '@cosmjs/stargate';
import { fromAscii, fromBase64, toAscii } from '@cosmjs/encoding';
import { txTraceMachine } from '../txs-trace-machine';

export const crossSwapTraceMachine = createMachine(
	{
		id: 'crossSwapTraceMachine',
		initial: 'idle',
		schema: {
			context: {} as CrossSwapTraceContext,
			events: {} as CrossSwapTraceEvents,
		},
		states: {
			idle: {
				on: {
					TRACE: {
						target: 'trace_ibc_m1',
						actions: assign({
							srcChannel: (_, event) => {
								return event.data.srcChannel;
							},
							dstChannel: (_, event) => {
								return event.data.dstChannel;
							},
							websocketUrl: (_, event) => {
								return event.data.websocketUrl;
							},
							query: (_, event) => {
								return event.data.query;
							},
						}),
					},
				},
			},
			trace_ibc_m1: {
				invoke: {
					id: 'traceIBCM1',
					src: ibcTraceMachine,
					data: {
						subscribeTimeout: (context: CrossSwapTraceContext) =>
							context.subscribeTimeout,
						connectionTimeout: (context: CrossSwapTraceContext) =>
							context.connectionTimeout,
					},
					onDone: {
						actions: choose<
							CrossSwapTraceContext,
							DoneInvokeEvent<IBCTraceDataResponse>,
							DoneInvokeEvent<IBCTraceDataResponse>
						>([
							{
								cond: (_, event) => {
									return (
										event.data.state === IBCTraceFinalState.Complete &&
										event.data.tx !== undefined
									);
								},
								actions: raise<
									CrossSwapTraceContext,
									DoneInvokeEvent<IBCTraceDataResponse>,
									DoneInvokeEvent<IBCTraceDataResponse | IBCTraceAckEventPayload>
								>((_, event) => ({
									type: 'TRACE_M2',
									data: {
										tx: event.data.tx,
									},
								})),
							},
							{
								actions: raise((_, event) => ({
									type: 'ON_ERROR',
									data: {
										state: event.data.state,
										code: event.data.errorCode,
									},
								})),
							},
						]),
					},
				},
				entry: [
					'toggleLoading',
					'increaseStep',
					sendTo('traceIBCM1', (ctx, event) => ({
						type: 'TRACE',
						data: {
							query: event.type === 'TRACE' ? event.data.query : '',
							websocketUrl: ctx.websocketUrl,
							srcChannel: ctx.srcChannel,
							dstChannel: ctx.dstChannel,
						},
					})),
				],
				exit: ['toggleLoading'],
				on: {
					TRACE_M2: {
						target: 'trace_ibc_m2',
						actions: assign({
							M1Tx: (_, event) => {
								return event.data.tx;
							},
						}),
					},
					ON_ERROR: {
						target: 'error',
						actions: assign({
							errorCode: (_, event) => {
								return event.data.code;
							},
						}),
					},
				},
			},
			trace_ibc_m2: {
				invoke: {
					id: 'traceIBCM2',
					src: txTraceMachine,
					data: {
						subscribeTimeout: (context: CrossSwapTraceContext) =>
							context.subscribeTimeout,
						connectionTimeout: (context: CrossSwapTraceContext) =>
							context.connectionTimeout,
					},
					onDone: {
						actions: choose<
							CrossSwapTraceContext,
							DoneInvokeEvent<TxTraceDataResponse>,
							DoneInvokeEvent<IBCTraceAckEventPayload | TxTraceDataResponse>
						>([
							{
								cond: (_, event) => {
									return (
										event.data.state === TxTraceFinalState.Result &&
										event.data.txs !== undefined &&
										event.data.txs.length > 0 &&
										event.data.txs[0].code === 0
									);
								},
								actions: raise((_, event) => ({
									type: 'ON_COMPLETE',
									data: {
										tx: event.data.txs ? event.data.txs[0] : undefined,
									},
								})),
							},
							{
								actions: raise((_, event) => ({
									type: 'ON_ERROR',
									data: {
										state: event.data.state,
										code:
											event.data.txs && event.data.txs.length > 0
												? event.data.txs[0].code
												: -1,
									},
								})),
							},
						]),
					},
				},
				entry: [
					'toggleLoading',
					'increaseStep',
					sendTo('traceIBCM2', (ctx: CrossSwapTraceContext) => {
						const tx = ctx.M1Tx;

						if (tx) {
							const events = [...tx.events].reverse();
							const fungibleTokenPacket = events.find(
								e => e.type === 'fungible_token_packet',
							);

							if (fungibleTokenPacket) {
								const success = fungibleTokenPacket.attributes.find(
									e => e.key === 'success',
								);

								if (success) {
									const responseRaw: SwapContractResponseRaw = JSON.parse(success.value);

									const response: SwapContractResponse = {
										contract_result: JSON.parse(
											fromAscii(fromBase64(responseRaw.contract_result)),
										),
										ibc_ack: JSON.parse(fromAscii(fromBase64(responseRaw.ibc_ack))),
									};

									return {
										type: 'TRACE',
										data: {
											query: `write_acknowledgement.packet_src_channel='${ctx.dstChannel}' and write_acknowledgement.packet_dst_channel='${ctx.srcChannel}' and write_acknowledgement.packet_sequence=${response.contract_result.packet_sequence}`,
											websocketUrl: ctx.websocketUrl,
										},
									};
								}
							}
						}

						return {
							type: 'TRACE',
						};
					}),
				],
				exit: ['toggleLoading'],
				on: {
					ON_COMPLETE: {
						target: 'complete',
						actions: assign({
							M2Tx: (_, event) => {
								return event.data.tx;
							},
						}),
					},
					ON_ERROR: {
						target: 'error',
						actions: assign({
							errorCode: (_, event) => {
								return event.data.code;
							},
						}),
					},
				},
			},
			complete: {
				entry: ['increaseStep'],
				type: 'final',
				data: ctx => ({
					state: CrossSwapTraceFinalState.Complete,
					M1Tx: ctx.M1Tx,
					M2Tx: ctx.M2Tx,
				}),
			},
			error: {
				type: 'final',
				data: ctx => ({
					state: CrossSwapTraceFinalState.Error,
					errorCode: ctx.errorCode,
				}),
			},
		},
		context: {
			subscribeTimeout: 60_000,
			connectionTimeout: 10_000,
			websocketUrl: 'wss://rpc-osmosis.blockapsis.com',
			loading: false,
			currentStep: 0,
			errorCode: 0,
			query: '',
		},
		predictableActionArguments: true,
		preserveActionOrder: true,
	},
	{
		actions: {
			toggleLoading: context => {
				context.loading = !context.loading;
			},
			increaseStep: context => {
				context.currentStep = context.currentStep + 1;
			},
		},
	},
);
