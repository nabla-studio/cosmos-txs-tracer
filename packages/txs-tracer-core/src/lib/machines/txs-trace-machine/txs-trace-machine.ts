import { assign, createMachine, DoneInvokeEvent, raise } from 'xstate';
import {
	Tendermint34Client,
	TxEvent,
	TxResponse,
	TxSearchResponse,
} from '@cosmjs/tendermint-rpc';
import { TxTraceContext, TxTraceEvents, TxTraceFinalState } from '../../types';
import { mapIndexedTx, streamToPromise } from '../../utils';

export const txTraceMachine = createMachine(
	{
		initial: 'idle',
		states: {
			open_connection: {
				invoke: {
					id: 'openWebsocketConnection',
					src: ctx => async callback => {
						try {
							ctx.tendermintClient = await Tendermint34Client.connect(
								ctx.websocketUrl,
							);

							callback('CONNECTION_SUCCESS');
						} catch (err) {
							callback('CONNECTION_ERROR');
						}
					},
				},
				after: {
					CONNECTION_TIMEOUT: {
						target: 'connection_timeout',
					},
				},
				on: {
					CONNECTION_SUCCESS: {
						target: 'connected',
						actions: raise('SEND_QUERY_MESSAGE'),
					},
					CONNECTION_ERROR: {
						target: 'closed',
					},
				},
			},
			pending_search_txs: {
				invoke: {
					src: ctx => {
						if (ctx.tendermintClient) {
							return ctx.tendermintClient.txSearchAll({ query: ctx.query });
						}

						return new Promise((_, reject) => {
							reject();
						});
					},
					onDone: {
						target: 'result',
						actions: assign<
							TxTraceContext,
							DoneInvokeEvent<TxSearchResponse>,
							DoneInvokeEvent<TxSearchResponse>
						>({ txs: (_, event) => event.data.txs.map(mapIndexedTx) }),
					},
					onError: {
						target: 'connection_error',
					},
				},
			},
			pending_subscription: {
				invoke: {
					src: ctx => {
						if (ctx.tendermintClient) {
							return streamToPromise<TxEvent>(
								ctx.tendermintClient.subscribeTx(ctx.query).take(1),
								ctx.subscribeTimeout + 5_000,
							);
						}

						return new Promise((_, reject) => {
							reject();
						});
					},
					onDone: {
						target: 'result',
						actions: assign<
							TxTraceContext,
							DoneInvokeEvent<TxResponse>,
							DoneInvokeEvent<TxResponse>
						>({
							txs: (_, event) => [mapIndexedTx(event.data)],
						}),
					},
					onError: {
						target: 'connection_error',
					},
				},
				after: {
					SUBSCRIBE_TIMEOUT: {
						target: 'pending_search_txs',
					},
				},
			},
			result: {
				type: 'final',
				data: ctx => ({
					state: TxTraceFinalState.Result,
					txs: ctx.txs,
				}),
				entry: ['closeConnection'],
			},
			connected: {
				on: {
					SEND_QUERY_MESSAGE: { target: 'pending_subscription' },
				},
			},
			closed: {
				type: 'final',
				data: () => ({
					state: TxTraceFinalState.Closed,
				}),
				entry: ['closeConnection'],
			},
			connection_timeout: {
				type: 'final',
				data: () => ({
					state: TxTraceFinalState.ConnectionTimeout,
				}),
				entry: ['closeConnection'],
			},
			connection_error: {
				type: 'final',
				data: () => ({
					state: TxTraceFinalState.ConnectionError,
				}),
				entry: ['closeConnection'],
			},
			idle: {
				on: {
					TRACE: {
						target: 'open_connection',
						actions: assign({
							query: (_, event) => {
								return event.data.query;
							},
							websocketUrl: (_, event) => {
								return event.data.websocketUrl;
							},
						}),
					},
				},
			},
		},
		schema: {
			context: {} as TxTraceContext,
			events: {} as TxTraceEvents,
		},
		context: {
			tendermintClient: undefined,
			subscribeTimeout: 60_000,
			connectionTimeout: 10_000,
			websocketUrl: 'wss://rpc-osmosis.blockapsis.com',
			query: '',
			txs: [],
		},
		predictableActionArguments: true,
		preserveActionOrder: true,
	},
	{
		actions: {
			closeConnection: ctx => {
				if (ctx.tendermintClient) {
					ctx.tendermintClient.disconnect();

					ctx.tendermintClient = undefined;
				}
			},
		},
		delays: {
			SUBSCRIBE_TIMEOUT: context => {
				return context.subscribeTimeout;
			},
			CONNECTION_TIMEOUT: context => {
				return context.connectionTimeout;
			},
		},
	},
);
