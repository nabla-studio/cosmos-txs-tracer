import { interpret } from 'xstate';
import { txTraceMachine } from './txs-trace-machine';

test('should eventually reach "connected"', () =>
	new Promise<void>(done => {
		const fetchService = interpret(txTraceMachine).onTransition(state => {
			if (state.matches('connected')) {
				done();
			}
		});

		fetchService.start();

		/*
		 *  Send zero or more events to the service that should
		 *  cause it to eventually reach its expected state
		 */
		fetchService.send({ type: 'TRACE' });
	}));
