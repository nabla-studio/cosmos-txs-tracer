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
	txs?: IndexedTx;
	ackTx?: IndexedTx;
};

export type IBCTraceEventPayload = TxTraceEventPayload;

export type IBCMachineResultErrorPayload = {
	type: TxTraceFinalStates;
	code: number;
};

export type IBCTraceAckEventPayload = {
	tx?: IndexedTx;
};

export const IBCTraceFinalState = {
	Complete: 'complete',
	Error: 'error',
} as const;

export const IBCTraceState = {
	SendPacket: 'send_packet',
	AcknowledgePacket: 'acknowledge_packet',
	Idle: 'idle',
	...IBCTraceFinalState,
} as const;

export type IBCTraceFinalStates =
	(typeof IBCTraceFinalState)[keyof typeof IBCTraceFinalState];

export interface IBCTraceDataResponse {
	state: IBCTraceFinalStates;
	tx?: IndexedTx;
	errorCode?: number;
}

export type IBCTraceEvents =
	| { type: 'TRACE'; data: IBCTraceEventPayload }
	| { type: 'TRACE_ACK'; data: IBCTraceAckEventPayload }
	| { type: 'ON_ERROR'; data: IBCMachineResultErrorPayload }
	| { type: 'TRACE_COMPLETED'; data: IBCTraceAckEventPayload };
