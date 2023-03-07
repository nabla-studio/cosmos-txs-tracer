import { IndexedTx } from '@cosmjs/stargate';
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';

export interface TxTraceContext {
	subscribeTimeout: number;
	connectionTimeout: number;
	websocketUrl: string;
	query: string;
	txs: IndexedTx[];
	tendermintClient?: Tendermint34Client;
}

export interface TxTraceEventPayload {
	query: string;
	websocketUrl: string;
}

export type TxTraceEvents =
	| { type: 'TX_RESULTS' }
	| { type: 'CONNECTION_SUCCESS' }
	| { type: 'CONNECTION_ERROR' }
	| { type: 'SEND_QUERY_MESSAGE' }
	| { type: 'CONNECTION_DISCONNECT' }
	| { type: 'TRACE'; data: TxTraceEventPayload }
	| { type: 'TX_SEARCH_EMPTY' };

export const TxTraceFinalState = {
	Result: 'result',
	Closed: 'closed',
	ConnectionTimeout: 'connection_timeout',
	ConnectionError: 'connection_error',
} as const;

export const TxTraceState = {
	OpenConnection: 'open_connection',
	PendingSearchTXs: 'pending_search_txs',
	PendingSubscription: 'pending_subscription',
	Connected: 'connected',
	Idle: 'idle',
	...TxTraceFinalState,
} as const;

export type TxTraceFinalStates =
	(typeof TxTraceFinalState)[keyof typeof TxTraceFinalState];

export interface TxTraceDataResponse {
	state: TxTraceFinalStates;
	txs?: IndexedTx[];
}
