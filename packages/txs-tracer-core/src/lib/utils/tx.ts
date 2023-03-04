import { TxEvent, TxResponse } from '@cosmjs/tendermint-rpc';
import { fromTendermint34Event, IndexedTx } from '@cosmjs/stargate';
import { toHex } from '@cosmjs/encoding';

export const mapIndexedTx = (tx: TxResponse | TxEvent): IndexedTx => ({
	height: tx.height,
	hash: toHex(tx.hash).toUpperCase(),
	code: tx.result.code,
	events: tx.result.events.map(fromTendermint34Event),
	rawLog: tx.result.log || '',
	tx: tx.tx,
	gasUsed: tx.result.gasUsed,
	gasWanted: tx.result.gasWanted,
});
