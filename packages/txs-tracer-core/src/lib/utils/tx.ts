import { TxResponse } from '@cosmjs/tendermint-rpc';
import { fromTendermintEvent, IndexedTx } from '@cosmjs/stargate';
import { toHex } from '@cosmjs/encoding';

export const mapIndexedTx = (tx: TxResponse): IndexedTx => {
	return {
		txIndex: tx.index,
		height: tx.height,
		hash: toHex(tx.hash).toUpperCase(),
		code: tx.result.code,
		events: tx.result.events.map(fromTendermintEvent),
		rawLog: tx.result.log || '',
		tx: tx.tx,
		gasUsed: tx.result.gasUsed,
		gasWanted: tx.result.gasWanted,
	};
};
