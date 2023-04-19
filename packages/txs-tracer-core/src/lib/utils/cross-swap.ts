import { IndexedTx } from '@cosmjs/stargate';
import { SwapContractResponseRaw, SwapContractResponse } from '../types';
import { fromAscii, fromBase64 } from '@cosmjs/encoding';
import { Attribute } from '@cosmjs/stargate';

export const getFungibleTokenPacketResponses = (tx: IndexedTx) => {
	const fungibleTokenPackets = tx.events.filter(
		e => e.type === 'fungible_token_packet',
	);

	let success: Attribute | undefined = undefined;
	let error: Attribute | undefined = undefined;

	for (const fungibleTokenPacket of fungibleTokenPackets) {
		success = fungibleTokenPacket.attributes.find(e => e.key === 'success');

		const currentError = fungibleTokenPacket.attributes.find(
			e => e.key === 'error',
		);

		if (currentError) {
			error = currentError;
		}
	}

	return {
		success,
		error,
	};
};

export const getCrossSwapPacketSequence = (tx: IndexedTx) => {
	const { success, error } = getFungibleTokenPacketResponses(tx);

	try {
		if (success) {
			const responseRaw: SwapContractResponseRaw = JSON.parse(success.value);

			const response: SwapContractResponse = {
				contract_result: JSON.parse(
					fromAscii(fromBase64(responseRaw.contract_result)),
				),
				ibc_ack: JSON.parse(fromAscii(fromBase64(responseRaw.ibc_ack))),
			};

			return {
				packetSequence: response.contract_result.packet_sequence,
				error: undefined,
			};
		}
	} catch {
		return {
			packetSequence: undefined,
			error: 'Unknown error',
		};
	}

	if (error) {
		return {
			packetSequence: undefined,
			error: error.value,
		};
	}

	return {
		packetSequence: undefined,
		error: 'Unknown error',
	};
};
