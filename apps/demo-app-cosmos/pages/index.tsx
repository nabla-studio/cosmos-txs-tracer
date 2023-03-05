import { useChain, useWallet } from '@cosmos-kit/react';
import styled from '@emotion/styled';

const StyledPage = styled.div`
	.page {
	}
`;

export function Index() {
	const { username, connect, disconnect, wallet } = useChain("osmosis");
  const { status: globalStatus } = useWallet();

	/*s
	 * Replace the elements below with your own.
	 *
	 * Note: The corresponding styles are in the ./index.@emotion/styled file.
	 */
	return (
		<StyledPage>
			<div className="wrapper">
				<button onClick={() => connect()}>Connect</button>
			</div>
		</StyledPage>
	);
}

export default Index;
