import { IndexedTx } from '@cosmjs/stargate';
import {
	IBCMachineResultErrorPayload,
	IBCTraceAckEventPayload,
	IBCTraceContext,
	IBCTraceEventPayload,
	IBCTraceParentEvents,
} from './ibc-trace';

export type CrossSwapTraceContext = Omit<IBCTraceContext, 'ackTx' | 'txs'> & {
	M1Tx?: IndexedTx;
	M2Tx?: IndexedTx;
	txHash: string;
	errorMessage?: string;
	totalSteps: number;
	/**
	 * Data definitions for interchain swaps
	 */
	/**
	 * Channel related to token transfer using forward middleware on start.
	 * for example if I swap atom to osmo (And the swap is performed on Juno Chain),
	 * I'll set it to the channel between the Osmosis chain and the Cosmos Hub chain.
	 * endSrcChannel: channel-1
	 * endDstChannel: channel-207
	 */
	startSrcChannel?: string;
	startDstChannel?: string;
	/**
	 * Channel related to token transfer using forward middleware
	 * for example if I swap osmo to atom (And the swap is performed on Juno Chain),
	 * I'll set it to the channel between the Osmosis chain and the Cosmos Hub chain.
	 * endSrcChannel: channel-0
	 * endDstChannel: channel-141
	 */
	endSrcChannel?: string;
	endDstChannel?: string;
};

export type CrossSwapMachineResultErrorPayload =
	IBCMachineResultErrorPayload & {
		errorMessage?: string;
	};

export type CrossSwapTraceEventPayload = IBCTraceEventPayload & {
	txHash: string;
	startSrcChannel?: string;
	startDstChannel?: string;
	endSrcChannel?: string;
	endDstChannel?: string;
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
	| IBCTraceParentEvents
	| { type: 'TRACE'; data: CrossSwapTraceEventPayload }
	| { type: 'TRACE_M2'; data: IBCTraceAckEventPayload }
	| { type: 'ON_COMPLETE'; data: IBCTraceAckEventPayload }
	| { type: 'ON_ERROR'; data: CrossSwapMachineResultErrorPayload }
	| { type: 'RESET' }
	| { type: 'TRACE_COMPLETED' };
