import { interpret } from 'xstate';
import { txTraceMachine } from './txs-trace-machine';

describe('txs-trace-machine', () => {
	test('should eventually reach "pending_subscription"', () =>
		new Promise<void>(done => {
			const fetchService = interpret(
				txTraceMachine.withContext({
					...txTraceMachine.context,
				}),
			)
				.onTransition(state => {
					console.log(state.value);
					if (state.matches('pending_subscription')) {
						done();
					}
				})
				.onEvent(event => {
					console.log(event.type);
				});

			fetchService.start();

			/*
			 *  Send zero or more events to the service that should
			 *  cause it to eventually reach its expected state
			 */
			fetchService.send({ type: 'TRACE' });
		}));

	test(
		'should eventually reach "results"',
		() =>
			new Promise<void>(done => {
				const fetchService = interpret(
					txTraceMachine.withContext({
						...txTraceMachine.context,
						subscribeTimeout: 1000,
						query: "message.action='/osmosis.gamm.v1beta1.MsgSwapExactAmountIn'",
					}),
				).onTransition(state => {
					if (state.matches('results')) {
						console.log(state.context.txs);
						done();
					}
				});

				fetchService.start();

				/*
				 *  Send zero or more events to the service that should
				 *  cause it to eventually reach its expected state
				 */
				fetchService.send({ type: 'TRACE' });
			}),
		{
			timeout: 30_000,
		},
	);
});
