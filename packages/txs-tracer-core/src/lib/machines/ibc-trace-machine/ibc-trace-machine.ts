import {
	assign,
	createMachine,
	actions,
	sendTo,
	DoneInvokeEvent,
	raise,
} from 'xstate';
import {
	IBCTraceAckEventPayload,
	IBCTraceRecvEventPayload,
	IBCTraceContext,
	IBCTraceEvents,
	IBCTraceFinalState,
	TxTraceDataResponse,
	TxTraceFinalState,
} from '../../types';
import { txTraceMachine } from '../txs-trace-machine';
import { getPacketSequence } from '../../utils';

const { choose, sendParent } = actions;

const initialContext: IBCTraceContext = {
	subscribeTimeout: 60_000,
	connectionTimeout: 10_000,
	websocketUrl: 'wss://juno.com',
	dstWebsocketUrl: 'wss://rpc-osmosis.blockapsis.com',
	loading: false,
	currentStep: 0,
	errorCode: 0,
	query: '',
	srcChannel: '', // ex: channel-140
	dstChannel: '', // ex: channel-3316
	transferTx: undefined,
	recvTx: undefined,
	ackTx: undefined,
};

export const ibcTraceMachine = createMachine(
	{
		id: 'ibcTraceMachine',
		initial: 'idle',
		states: {
			idle: {
				on: {
					TRACE: {
						target: 'send_packet',
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
							dstWebsocketUrl: (_, event) => {
								return event.data.dstWebsocketUrl;
							},
							query: (_, event) => {
								return event.data.query;
							},
						}),
					},
				},
			},
			send_packet: {
				invoke: {
					id: 'sendPacketTrace',
					src: txTraceMachine,
					data: {
						subscribeTimeout: (context: IBCTraceContext) => context.subscribeTimeout,
						connectionTimeout: (context: IBCTraceContext) =>
							context.connectionTimeout,
					},
					onDone: {
						actions: choose<
							IBCTraceContext,
							DoneInvokeEvent<TxTraceDataResponse>,
							DoneInvokeEvent<TxTraceDataResponse | IBCTraceRecvEventPayload>
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
								actions: raise<
									IBCTraceContext,
									DoneInvokeEvent<TxTraceDataResponse>,
									DoneInvokeEvent<IBCTraceRecvEventPayload>
								>((_, event) => {
									return {
										type: 'TRACE_RECV',
										data: {
											tx: event.data.txs ? event.data.txs[0] : undefined,
										},
									};
								}),
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
					'startLoading',
					sendTo('sendPacketTrace', (ctx, event) => ({
						type: 'TRACE',
						data: {
							query: event.type === 'TRACE' ? event.data.query : '',
							websocketUrl: ctx.websocketUrl,
						},
					})),
				],
				on: {
					TRACE_RECV: {
						target: 'receive_packet',
						actions: assign({
							transferTx: (_, event) => {
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
			/**
			 * The receive packet on the destination chain.
			 */
			receive_packet: {
				invoke: {
					id: 'sendReceivePacketTrace',
					src: txTraceMachine,
					data: {
						subscribeTimeout: (context: IBCTraceContext) => context.subscribeTimeout,
						connectionTimeout: (context: IBCTraceContext) =>
							context.connectionTimeout,
					},
					onDone: {
						actions: choose<
							IBCTraceContext,
							DoneInvokeEvent<TxTraceDataResponse>,
							DoneInvokeEvent<TxTraceDataResponse | IBCTraceAckEventPayload>
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
								actions: raise<
									IBCTraceContext,
									DoneInvokeEvent<TxTraceDataResponse>,
									DoneInvokeEvent<IBCTraceAckEventPayload>
								>((_, event) => {
									return {
										type: 'TRACE_ACK',
										data: {
											tx: event.data.txs ? event.data.txs[0] : undefined,
										},
									};
								}),
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
					sendParent('INCREASE_STEP'),
					sendTo('sendReceivePacketTrace', ctx => {
						const tx = ctx.transferTx;

						if (tx) {
							const { packetSequence } = getPacketSequence(tx, 'send_packet');

							if (packetSequence) {
								return {
									type: 'TRACE',
									data: {
										query: `recv_packet.packet_src_channel='${ctx.srcChannel}' and recv_packet.packet_dst_channel='${ctx.dstChannel}' and recv_packet.packet_sequence=${packetSequence.value}`,
										websocketUrl: ctx.dstWebsocketUrl,
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
					TRACE_ACK: {
						target: 'acknowledge_packet',
						actions: assign({
							recvTx: (_, event) => {
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
			acknowledge_packet: {
				invoke: {
					id: 'sendAckPacketTrace',
					src: txTraceMachine,
					data: {
						subscribeTimeout: (context: IBCTraceContext) => context.subscribeTimeout,
						connectionTimeout: (context: IBCTraceContext) =>
							context.connectionTimeout,
					},
					onDone: {
						actions: choose<
							IBCTraceContext,
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
								actions: raise((_, event) => {
									return {
										type: 'TRACE_COMPLETED',
										data: {
											tx: event.data.txs ? event.data.txs[0] : undefined,
										},
									};
								}),
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
					sendParent('INCREASE_STEP'),
					sendTo('sendAckPacketTrace', ctx => {
						const tx = ctx.transferTx;

						if (tx) {
							const { packetSequence } = getPacketSequence(tx, 'send_packet');

							if (packetSequence) {
								return {
									type: 'TRACE',
									data: {
										query: `acknowledge_packet.packet_src_channel='${ctx.srcChannel}' and acknowledge_packet.packet_dst_channel='${ctx.dstChannel}' and acknowledge_packet.packet_sequence=${packetSequence.value}`,
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
					TRACE_COMPLETED: {
						target: 'complete',
						actions: assign({
							ackTx: (_, event) => {
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
				entry: ['stopLoading', 'increaseStep', sendParent('INCREASE_STEP')],
				type: 'final',
				data: ctx => ({
					state: IBCTraceFinalState.Complete,
					transferTx: ctx.transferTx,
					recvTx: ctx.recvTx,
					ackTx: ctx.ackTx,
				}),
			},
			error: {
				entry: ['stopLoading'],
				type: 'final',
				data: ctx => ({
					state: IBCTraceFinalState.Error,
					errorCode: ctx.errorCode,
				}),
			},
		},
		schema: {
			context: {} as IBCTraceContext,
			events: {} as IBCTraceEvents,
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
