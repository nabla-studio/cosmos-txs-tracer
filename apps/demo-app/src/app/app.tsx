import styled from '@emotion/styled';

import { Route, Routes, Link } from 'react-router-dom';
import { useMachine } from '@xstate/react';
import { txTraceMachine } from '@nabla-studio/txs-tracer-core'
import { useEffect } from 'react';

const StyledApp = styled.div`
	// Your style here
`;

export function App() {
	const [state, send] = useMachine(txTraceMachine, {
		context: {
			...txTraceMachine.context,
			subscribeTimeout: 10_000,
			query: "message.action='/osmosis.gamm.v1beta1.MsgSwapExactAmountIn'"
		},
	});

	console.log(state.context.txs);

	return (
		<StyledApp>
			<p>{state.value.toString()}</p>
			<button onClick={() => send({ type: 'TRACE' })}>Trace</button>

			{/* START: routes */}
			{/* These routes and navigation have been generated for you */}
			{/* Feel free to move and update them to fit your needs */}
			<br />
			<hr />
			<br />
			<div role="navigation">
				<ul>
					<li>
						<Link to="/">Home</Link>
					</li>
					<li>
						<Link to="/page-2">Page 2</Link>
					</li>
				</ul>
			</div>
			<Routes>
				<Route
					path="/"
					element={
						<div>
							This is the generated root route.{' '}
							<Link to="/page-2">Click here for page 2.</Link>
						</div>
					}
				/>
				<Route
					path="/page-2"
					element={
						<div>
							<Link to="/">Click here to go back to root page.</Link>
						</div>
					}
				/>
			</Routes>
			{/* END: routes */}
		</StyledApp>
	);
}

export default App;
