import { Tendermint34Client } from '@cosmjs/tendermint-rpc';

export interface TxTraceContext {
	txTimeout: number;
	connectionTimeout: number;
	websocketUrl: string;
	query: string;
	method: string;
	tendermintClient?: Tendermint34Client;
}
