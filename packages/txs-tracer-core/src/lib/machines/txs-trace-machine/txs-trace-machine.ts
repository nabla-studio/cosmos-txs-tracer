import { createMachine, raise } from 'xstate';
import { Tendermint34Client, TxEvent } from '@cosmjs/tendermint-rpc';
import { Listener, Stream } from 'xstream';
import { TxTraceContext, TxTraceEvents } from '../../types';
import { mapIndexedTx } from '../../utils';

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
							console.log(err);
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
				on: {
					TX_RESULTS: {
						target: 'result',
					},
					CONNECTION_DISCONNECT: {
						target: 'connection_error',
					},
					TX_SEARCH_EMPTY: {
						target: 'not_found_error',
					},
				},
			},
			pending_subscription: {
				entry: ['subscribeToQuery'],
				after: {
					SUBSCRIBE_TIMEOUT: {
						target: 'pending_search_txs',
					},
				},
				on: {
					TX_RESULTS: {
						target: 'result',
					},
					CONNECTION_DISCONNECT: {
						target: 'connection_error',
					},
				},
			},
			result: {
				type: 'final',
				data: (ctx, event) => ({
					event,
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
				entry: ['closeConnection'],
			},
			connection_timeout: {
				type: 'final',
				entry: ['closeConnection'],
			},
			not_found_error: {
				type: 'final',
				entry: ['closeConnection'],
			},
			connection_error: {
				type: 'final',
				entry: ['closeConnection'],
			},
			idle: {
				on: {
					TRACE: {
						target: 'open_connection',
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
			subscribeTimeout: 5000,
			connectionTimeout: 5000,
			websocketUrl: 'wss://rpc-osmosis.blockapsis.com',
			query: "acknowledge_packet.packet_sequence='1777404'",
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
			subscribeToQuery: ctx => {
				let subscription: Stream<TxEvent>;
				let listener: Listener<TxEvent>;

				if (ctx.tendermintClient) {
					subscription = ctx.tendermintClient.subscribeTx(ctx.query).take(1);

					listener = {
						next: txResult => {
							ctx.txs = [mapIndexedTx(txResult)];
						},
						error: err => {
							console.error(err);
							raise('CONNECTION_DISCONNECT');
						},
						complete: () => {
							raise('TX_RESULTS');
						},
					};

					subscription.addListener(listener);
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
