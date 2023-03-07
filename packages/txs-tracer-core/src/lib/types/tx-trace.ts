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
