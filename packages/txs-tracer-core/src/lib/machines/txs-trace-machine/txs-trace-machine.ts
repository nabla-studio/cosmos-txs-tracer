import { createMachine } from 'xstate';
import { TxTraceContext } from '../../types';

export const txTraceMachine = createMachine(
	{
		initial: 'idle',
		states: {
			open_connection: {
				invoke: {
					id: 'openWebsocketConnection',
					src: ctx => callback => {
						try {
							ctx.socketClient = new WebSocket(ctx.websocketUrl);

							const connectedHandler = () => callback('CONNECTION_SUCCESS');
							ctx.socketClient.addEventListener('open', connectedHandler);

							return () => {
								ctx.socketClient?.removeEventListener('open', connectedHandler);
							};
						} catch (err) {
							callback('CONNECTION_ERROR');
						}

						return () => {
							ctx.socketClient = undefined;
						};
					},
				},
				on: {
					CONNECTION_SUCCESS: {
						target: 'connected',
					},
					CONNECTION_ERROR: {
						target: 'closed',
					},
				},
			},
			pending: {
				after: {
					TX_TIMEOUT: {
						target: 'pending',
					},
				},
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
			result: {
				type: 'final',
			},
			connected: {
				on: {
					SEND_QUERY_MESSAGE: {
						target: 'pending',
					},
				},
			},
			closed: {
				type: 'final',
			},
			not_found_error: {
				type: 'final',
			},
			connection_error: {
				type: 'final',
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
			events: {} as
				| { type: 'TX_RESULTS' }
				| { type: 'CONNECTION_SUCCESS' }
				| { type: 'CONNECTION_ERROR' }
				| { type: 'SEND_QUERY_MESSAGE' }
				| { type: 'CONNECTION_DISCONNECT' }
				| { type: 'TRACE' }
				| { type: 'TX_SEARCH_EMPTY' },
		},
		context: {
			socketClient: undefined,
			txTimeout: 5000,
			connectionTimeout: 5000,
			websocketUrl: 'wss://rpc-osmosis.blockapsis.com/websocket',
			query: "acknowledge_packet.packet_sequence='1753590'",
			method: 'tx_search',
		},
		predictableActionArguments: true,
		preserveActionOrder: true,
	},
	{
		delays: {
			TX_TIMEOUT: context => {
				return context.txTimeout;
			},
		},
	},
);
