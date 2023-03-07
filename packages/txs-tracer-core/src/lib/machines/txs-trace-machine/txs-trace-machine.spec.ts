import { interpret } from 'xstate';
import { txTraceMachine } from './txs-trace-machine';

describe('txs-trace-machine', () => {
	test('should eventually reach "pending_subscription"', () =>
		new Promise<void>(done => {
			const fetchService = interpret(
				txTraceMachine.withContext({
					...txTraceMachine.context,
				}),
			).onTransition(state => {
				if (state.matches('pending_subscription')) {
					done();
				}
			});

			fetchService.start();

			/*
			 *  Send zero or more events to the service that should
			 *  cause it to eventually reach its expected state
			 */
			fetchService.send({
				type: 'TRACE',
				data: {
					query: "message.action='/osmosis.gamm.v1beta1.MsgSwapExactAmountIn'",
					websocketUrl: 'wss://rpc-osmosis.blockapsis.com',
				},
			});
		}));

	test(
		'should eventually reach "result" from pending_subscription',
		() =>
			new Promise<void>(done => {
				const fetchService = interpret(
					txTraceMachine.withContext({
						...txTraceMachine.context,
						subscribeTimeout: 20000,
						query: "message.action='/osmosis.gamm.v1beta1.MsgSwapExactAmountIn'",
					}),
				).onTransition(state => {
					console.log(state.value);
					if (state.matches('result')) {
						done();
					}
				});

				fetchService.start();

				/*
				 *  Send zero or more events to the service that should
				 *  cause it to eventually reach its expected state
				 */
				fetchService.send({
					type: 'TRACE',
					data: {
						query: "message.action='/osmosis.gamm.v1beta1.MsgSwapExactAmountIn'",
						websocketUrl: 'wss://rpc-osmosis.blockapsis.com',
					},
				});
			}),
		{
			timeout: 30_000,
		},
	);

	test(
		'should eventually reach "result" from pending_search_txs',
		() =>
			new Promise<void>(done => {
				const fetchService = interpret(
					txTraceMachine.withContext({
						...txTraceMachine.context,
						subscribeTimeout: 5_000,
					}),
				).onTransition(state => {
					if (state.matches('result')) {
						done();
					}
				});

				fetchService.start();

				/*
				 *  Send zero or more events to the service that should
				 *  cause it to eventually reach its expected state
				 */
				fetchService.send({
					type: 'TRACE',
					data: {
						query: 'acknowledge_packet.packet_sequence=1777404',
						websocketUrl: 'wss://rpc-osmosis.blockapsis.com',
					},
				});
			}),
		{
			timeout: 30_000,
		},
	);
});
