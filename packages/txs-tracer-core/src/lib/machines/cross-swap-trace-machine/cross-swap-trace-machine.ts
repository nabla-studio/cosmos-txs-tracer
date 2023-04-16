import { DoneInvokeEvent, assign, createMachine, raise, sendTo } from 'xstate';
import {
	CrossSwapTraceEvents,
	IBCTraceAckEventPayload,
	CrossSwapTraceContext,
	IBCTraceDataResponse,
	IBCTraceFinalState,
	CrossSwapTraceFinalState,
	TxTraceFinalState,
	TxTraceDataResponse,
} from '../../types';
import { ibcTraceMachine } from '../ibc-trace-machine';
import { choose } from 'xstate/lib/actions';
import { txTraceMachine } from '../txs-trace-machine';
import { getCrossSwapPacketSequence } from '../../utils';

const initialContext: CrossSwapTraceContext = {
	subscribeTimeout: 60_000,
	connectionTimeout: 10_000,
	websocketUrl: 'wss://rpc-osmosis.blockapsis.com',
	loading: false,
	currentStep: 0,
	errorCode: 0,
	errorMessage: '',
	srcChannel: '',
	dstChannel: '',
	query: '',
};

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
										event.data.tx !== undefined &&
										getCrossSwapPacketSequence(event.data.tx).packetSequence !== undefined
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
								cond: (_, event) => {
									return (
										event.data.state === IBCTraceFinalState.Complete &&
										event.data.tx !== undefined &&
										getCrossSwapPacketSequence(event.data.tx).error !== undefined
									);
								},
								actions: raise((_, event) => {
									let errorMessage: string | undefined = '';

									if (event.data.tx) {
										const data = getCrossSwapPacketSequence(event.data.tx);

										errorMessage = data.error;
									}

									return {
										type: 'ON_ERROR',
										data: {
											state: event.data.state,
											code: event.data.errorCode,
											errorMessage,
										},
									};
								}),
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
					'startLoading',
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
					'increaseStep',
					sendTo('traceIBCM2', (ctx: CrossSwapTraceContext) => {
						const tx = ctx.M1Tx;

						if (tx) {
							const data = getCrossSwapPacketSequence(tx);

							if (data.packetSequence) {
								return {
									type: 'TRACE',
									data: {
										query: `write_acknowledgement.packet_src_channel='${ctx.dstChannel}' and write_acknowledgement.packet_dst_channel='${ctx.srcChannel}' and write_acknowledgement.packet_sequence=${data.packetSequence}`,
										websocketUrl: ctx.websocketUrl,
									},
								};
							}
						}

						return {
							type: 'TRACE',
						};
					}),
				],
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
				entry: ['stopLoading', 'increaseStep'],
				data: ctx => ({
					state: CrossSwapTraceFinalState.Complete,
					M1Tx: ctx.M1Tx,
					M2Tx: ctx.M2Tx,
				}),
				on: {
					RESET: {
						target: 'idle',
						actions: assign({
							...initialContext,
						}),
					},
				},
			},
			error: {
				entry: ['stopLoading'],
				data: ctx => ({
					state: CrossSwapTraceFinalState.Error,
					errorCode: ctx.errorCode,
				}),
				on: {
					RESET: {
						target: 'idle',
						actions: assign({
							...initialContext,
						}),
					},
				},
			},
		},
		context: {
			...initialContext,
		},
		predictableActionArguments: true,
		preserveActionOrder: true,
	},
	{
		actions: {
			startLoading: context => {
				context.loading = true;
			},
			stopLoading: context => {
				context.loading = false;
			},
			increaseStep: context => {
				context.currentStep = context.currentStep + 1;
			},
		},
	},
);
