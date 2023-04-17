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
	srcChannel: string;
	dstChannel: string;
	dstWebsocketUrl: string;
	errorCode?: number;
	txs?: IndexedTx;
	transferTx?: IndexedTx;
	ackTx?: IndexedTx;
	recvTx?: IndexedTx;
};

export type IBCTraceEventPayload = TxTraceEventPayload & {
	dstWebsocketUrl: string;
	srcChannel: string;
	dstChannel: string;
};

export type IBCMachineResultErrorPayload = {
	type: TxTraceFinalStates;
	code: number;
};

export type IBCTraceAckEventPayload = {
	tx?: IndexedTx;
};

export type IBCTraceRecvEventPayload = IBCTraceAckEventPayload;

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
	transferTx?: IndexedTx;
	ackTx?: IndexedTx;
	recvTx?: IndexedTx;
	errorCode?: number;
}

export type IBCTraceParentEvents = { type: 'INCREASE_STEP' };

export type IBCTraceEvents =
	| IBCTraceParentEvents
	| { type: 'TRACE'; data: IBCTraceEventPayload }
	| { type: 'TRACE_RECV'; data: IBCTraceRecvEventPayload }
	| { type: 'TRACE_ACK'; data: IBCTraceAckEventPayload }
	| { type: 'ON_ERROR'; data: IBCMachineResultErrorPayload }
	| { type: 'TRACE_COMPLETED'; data: IBCTraceAckEventPayload };
