# 🔍 Cosmos TXs Tracer

Cosmos TXs Tracer is a repository containing a TypeScript-based package, the
`txs-tracer-core` that enables to track a transaction on the Cosmos ecosystem,
and some demo applications that allow to test such a package. The tracer is
able to track both single chain transactions and IBC (cross-chain) ones, by
listening on the channel through a websocket connection, wihtout the usage of
polling.

## 🌐 Overview

The core package, is the implementation of two different FSMs that are
represented below. The first, implementing a tracker for single chain
transactions, which, in the success scenario, proceeds as follows:

1. initiates a websocket connection to the node server;
2. sends a query message to subscribe a specific event;
3. if does not receive any tx up to a particular point in time, a timeout fires
   and a search is performed.

![Single chain tx track FSM](https://github.com/nabla-studio/cosmos-txs-tracer/blob/main/docs/single_tx.jpeg)

The second, implements a tracker for IBC transactions, which involves tracking
transactions between multiple chains. In the success scenario, it proceeds as
follows:

1. send a packet (executing the listening as described above);
2. wait for the acknowledgement of the packet (executing the listening as
   described above);
3. it is considered completed only if receives the acknowledgement packet.

![IBC tx track FSM](https://github.com/nabla-studio/cosmos-txs-tracer/blob/main/docs/ibc_tx.jpeg)

In the end, the demo applications provides the ability to test the package in
two different scenarios:

1. The `apps/demo-app` simply show an example where it is possible to track a
   single tx. In particular, it listen on the first swap message it is sent;
2. The `apps/demo-app-cosmos` is a more complex example, using also the
   cosmos-kit, where the user is able to connect his wallet and perform TXs on the
   mainnet. More specifically, the user can:

- SEND and check the status of such a send transaction
- Perform an IBC between Osmosis and Cosmos and follow the whole transaction,
  by checking the IBC transfer status.

## 🔧 Installation

Node.js is required to run the project.

1. Clone the repository to your local machine:

```bash
git clone https://github.com/nabla-studio/cosmos-tx-tracer.git
```

2. Install the dependencies:

```bash
cd cosmos-tx-tracer
pnpm i
```

3. Start the development server for the one of the example app:

```bash
nx serve APP_NAME
```

example, to run the example `apps/demo-app`:

```bash
nx serve demo-app
```

4. Open your browser and navigate to http://localhost:4200 to see the app in
   action.

### Understand this workspace

Run `nx graph` to see a diagram of the dependencies of the projects.

### Remote caching

Run `npx nx connect-to-nx-cloud` to enable remote caching and make CI faster.

## 👥 Authors

👤 **Davide Segullo** (Code)

- Github: [@DavideSegullo](https://github.com/DavideSegullo)
- Twitter: [@davide_segullo](https://twitter.com/davide_segullo)

## 🎉 Contributing

We ❤️ contributions! If you'd like to contribute, please read our contributing
guidelines.

## 📜 License

This project is licensed under the Apache-2.0 License. See the LICENSE file for
more information.

## 🙋 Support

If you have any questions or comments about this project, please feel free to
contact us on discord.

Copyright © 2023 [nabla](https://github.com/nabla-studio).
