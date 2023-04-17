import { IndexedTx } from '@cosmjs/stargate';

export const getPacketSequence = (tx: IndexedTx, name: string) => {
	const packet = tx.events.find(e => e.type === name);

	if (packet) {
		const packetSequence = packet.attributes.find(
			e => e.key === 'packet_sequence',
		);

		return {
			packetSequence,
			error: undefined,
		};
	}

	return {
		packetSequence: undefined,
		error: undefined,
	};
};
