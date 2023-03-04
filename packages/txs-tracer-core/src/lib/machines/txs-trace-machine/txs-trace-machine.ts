import { createMachine, raise } from 'xstate';
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import { TxTraceContext } from '../../types';

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
					SEND_QUERY_MESSAGE: { target: 'pending' },
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
			tendermintClient: undefined,
			txTimeout: 5000,
			connectionTimeout: 5000,
			websocketUrl: 'wss://rpc-osmosis.blockapsis.com',
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
