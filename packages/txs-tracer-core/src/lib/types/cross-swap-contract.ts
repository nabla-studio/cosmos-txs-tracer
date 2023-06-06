export interface SwapContractResponseRaw {
	contract_result: string;
	ibc_ack: string;
}

export interface SwapContractResult {
	sent_amount: string;
	denom: string;
	channel_id: string;
	receiver: string;
	packet_sequence: number;
}

export interface SwapContractACK {
	result: string;
}

export interface SwapContractResponse {
	contract_result: SwapContractResult;
	ibc_ack: SwapContractACK;
}
