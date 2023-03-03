export interface TxTraceContext {
	txTimeout: number;
	connectionTimeout: number;
	websocketUrl: string;
	query: string;
	method: string;
	socketClient?: WebSocket;
}
