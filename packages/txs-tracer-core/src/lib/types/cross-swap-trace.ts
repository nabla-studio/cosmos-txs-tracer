import { IndexedTx } from '@cosmjs/stargate';
import {
	IBCMachineResultErrorPayload,
	IBCTraceAckEventPayload,
	IBCTraceContext,
	IBCTraceEventPayload,
} from './ibc-trace';

export type CrossSwapTraceContext = Omit<IBCTraceContext, 'ackTx' | 'txs'> & {
	M1Tx?: IndexedTx;
	M2Tx?: IndexedTx;
};

export const CrossSwapTraceFinalState = {
	Complete: 'complete',
	Error: 'error',
} as const;

export const CrossSwapTraceState = {
	TraceIBCM1: 'trace_ibc_m1',
	TraceIBCM2: 'trace_ibc_m2',
	Idle: 'idle',
	...CrossSwapTraceFinalState,
} as const;

export type CrossSwapTraceFinalStates =
	(typeof CrossSwapTraceFinalState)[keyof typeof CrossSwapTraceFinalState];

export type CrossSwapTraceEvents =
	| { type: 'TRACE'; data: IBCTraceEventPayload }
	| { type: 'TRACE_M2'; data: IBCTraceAckEventPayload }
	| { type: 'ON_COMPLETE'; data: IBCTraceAckEventPayload }
	| { type: 'ON_ERROR'; data: IBCMachineResultErrorPayload }
	| { type: 'TRACE_COMPLETED' };
