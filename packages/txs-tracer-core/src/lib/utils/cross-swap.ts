import { IndexedTx } from '@cosmjs/stargate';
import { SwapContractResponseRaw, SwapContractResponse } from '../types';
import { fromAscii, fromBase64 } from '@cosmjs/encoding';

export const getCrossSwapPacketSequence = (tx: IndexedTx) => {
	const events = [...tx.events].reverse();
	const fungibleTokenPacket = events.find(
		e => e.type === 'fungible_token_packet',
	);

	if (fungibleTokenPacket) {
		const success = fungibleTokenPacket.attributes.find(e => e.key === 'success');

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

		const error = fungibleTokenPacket.attributes.find(e => e.key === 'error');

		if (error) {
			return {
				packetSequence: undefined,
				error: error.value,
			};
		}
	}

	return {
		packetSequence: undefined,
		error: 'Unknown error',
	};
};
