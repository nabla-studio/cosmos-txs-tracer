import { IndexedTx } from '@cosmjs/stargate';
import {
	TxTraceContext,
	TxTraceEventPayload,
	TxTraceFinalStates,
} from './tx-trace';

export type IBCTraceContext = Omit<
	TxTraceContext,
	'txs' | 'tendermintClient'
> & {
	loading: boolean;
	currentStep: number;
	errorCode?: number;
};

export type IBCTraceEventPayload = TxTraceEventPayload;

export type IBCMachineResultErrorPayload = {
	type: TxTraceFinalStates;
	code: number;
};

export type IBCTraceAckEventPayload = {
	tx?: IndexedTx;
};

export type IBCTraceEvents =
	| { type: 'TRACE'; data: IBCTraceEventPayload }
	| { type: 'TRACE_ACK'; data: IBCTraceAckEventPayload }
	| { type: 'ON_ERROR'; data: IBCMachineResultErrorPayload }
	| { type: 'TRACE_COMPLETED' };
