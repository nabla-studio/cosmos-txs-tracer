import { Attribute, Event, IndexedTx } from '@cosmjs/stargate';
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
	IBCTraceContext,
	IBCTraceEvents,
	IBCTraceFinalState,
	TxTraceDataResponse,
	TxTraceFinalState,
} from '../../types';
import { txTraceMachine } from '../txs-trace-machine';

const { choose } = actions;

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
								>((_, event) => ({
									type: 'TRACE_ACK',
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
					sendTo('sendPacketTrace', (ctx, event) => ({
						type: 'TRACE',
						data: {
							query: event.type === 'TRACE' ? event.data.query : '',
							websocketUrl: ctx.websocketUrl,
						},
					})),
				],
				exit: ['toggleLoading'],
				on: {
					TRACE_ACK: {
						target: 'acknowledge_packet',
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
							DoneInvokeEvent<TxTraceDataResponse>
						>([
							{
								cond: (_, event) => {
									return (
										event.data.state === TxTraceFinalState.Result &&
										event.data.txs !== undefined &&
										event.data.txs.length > 0
									);
								},
								actions: raise(() => ({
									type: 'TRACE_COMPLETED',
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
					sendTo('sendAckPacketTrace', (ctx, event) => {
						const tx: IndexedTx | undefined =
							event.type === 'TRACE_ACK' ? event.data.tx : undefined;

						if (tx) {
							const sendPacket: Event | undefined = tx.events.find(
								e => e.type === 'send_packet',
							);

							if (sendPacket) {
								const packetSequence: Attribute | undefined =
									sendPacket.attributes.find(e => e.key === 'packet_sequence');

								if (packetSequence) {
									return {
										type: 'TRACE',
										data: {
											query: `acknowledge_packet.packet_sequence=${packetSequence.value}`,
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
					TRACE_COMPLETED: {
						target: 'complete',
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
					state: IBCTraceFinalState.Complete,
					tx: ctx.ackTx,
				}),
			},
			error: {
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
