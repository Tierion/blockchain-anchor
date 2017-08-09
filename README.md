# blockchain-anchor

[![JavaScript Style Guide](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

[![npm](https://img.shields.io/npm/l/blockchain-anchor.svg)](https://www.npmjs.com/package/blockchain-anchor)
[![npm](https://img.shields.io/npm/v/blockchain-anchor.svg)](https://www.npmjs.com/package/blockchain-anchor)

A javascript library for anchoring data onto the Bitcoin blockchain and confirming anchored data on Bitcoin and Ethereum.

## Installation

```
$ npm install blockchain-anchor
```

### Create BlockchainAnchor Object

```js
const BlockchainAnchor = require('blockchain-anchor')

let anchorOptions = {
  btcUseTestnet: true, // optional: use testnet for bitcoin transactions, default: false
  service: 'blockcypher', // optional: select a service to use, default: Any
  blockcypherToken: '521ddb6aa94143a58cab3ee0f65e6280', // optional: required only when using blockcypher service
  insightApiBase: 'http://my.server.com/insight-api' // optional: connect to a custom instance of Bitcore's insight api when using insightapi service, defaults to insight.bitpay.com public api
  // When overriding with insightApiBase, you must set btcUseTestnet to match the state of the server at insightApiBase
}

let anchor = new BlockchainAnchor(anchorOptions)
```
Bitcoin anchor data will be included in a transaction's OP_RETURN output. Ethereum anchor data will be included in the transaction's data payload. 

This package uses a set of 3rd party APIs to read and write data from the Bitcoin and Ethereum blockchains. When working with Bitcoin, the acceptable values for 'service' are `blockcypher`, `insightapi`, or `any`. If a specific service is chosen, then only that service will be used. If 'any' is chosen, then all services will be used, starting with one, and moving to the next in the event of failure. If you wish to use blockcypher, be sure to include a valid blockcypher token. Currently, only blockcypher service is capable of confirming Ethereum anchors.

## Usage

### Embed BTC

Embed your hex string data into the blockchain, and receive a Bitcoin transaction id and the raw transaction hex as a response.

```js
let privateKeyWIF = '91aFbdjd1Xj3VbXQg8rKsj5BQ8iYX1oncC3p5evRKsxXkEfnjg8' // for deriving keyPair used in transaction creation
let hexData = '05ae04314577b2783b4be98211d1b72476c59e9c413cfb2afa2f0c68e0d93911' // the hex data string to be anchored within a transaction
let feeTotalSatoshi = 39000 // the total fee paid for this transaction, in satoshi

let txResult
try {
  txResult = await anchor.btcOpReturnAsync(privateKeyWIF, hexData, feeTotalSatoshi)
  console.log(`New transaction id = ${txResult.txId}`)
  console.log(`Raw transaction = ${txResult.rawTx}`)
} catch (error) {
  console.error(error.message)
}
```

### Confirm BTC

Confirm your hex string data has been embedded into a Bitcoin transaction, returning true or false.

```js
let transactionId = '048ac54c4313dc6980cace9fac533d71f8fe5cad881f1271329b98183231a08f' // the transaction id to inspect for the anchored value
let expectedValue = '05ae04314577b2783b4be98211d1b72476c59e9c413cfb2afa2f0c68e0d93911' // the hex data string value to verify is anchored within the transaction

let confirmed
try {
  confirmed = await anchor.btcConfirmOpReturnAsync(transactionId, expectedValue)
  console.log(confirmed)
} catch (error) {
  console.error(error.message)
}
```

### Confirm BTC Block Header

Confirm your hex string data equals the Merkle root of the given BTC block, returning true or false.

```js
var blockHeight = 435821 // the height of the block to confirm Merkle root value
var expectedValue = '2b10349367c46a91c485abca4f7834454118d631f28996fb2908a0fe8cefa0cd' // the hex data string value of the expected Merkle root value for the block

let confirmed
try {
  confirmed = await anchor.btcConfirmBlockHeaderAsync(blockHeight, expectedValue)
  console.log(confirmed)
} catch (error) {
  console.error(error.message)
}
```

### Get BTC Transaction Stats

Get basic statistics about a transaction, returning an object containing the transaction id, block height, block hash, confirmation count, fee paid, and size.

```js
var transactionId = 'b61b35f6f274663c4a1c062174925b97dc705cbfca9bd704e91c7d352f709e9c' // the transaction id to to get the stats for

let count
try {
  count = await anchor.btcGetTxStatsAsync(transactionId)
  console.log(count)
} catch (error) {
  console.error(error.message)
}
```

### Get BTC Transaction Confirmation Count

Find the number of confirmations for a given transaction, returning a number.

```js
var transactionId = 'b61b35f6f274663c4a1c062174925b97dc705cbfca9bd704e91c7d352f709e9c' // the transaction id to to get the confirmation count for

let count
try {
  count = await anchor.btcGetTxConfirmationCountAsync(transactionId)
  console.log(count)
} catch (error) {
  console.error(error.message)
}
```

### Get BTC Block Transaction Ids

Get all the transaction ids in a given block, returning an array of transaction id hex strings.

```js
var blockHeight = 435821 // the height of the block to confirm Merkle root value

let txArray
try {
  txArray = await anchor.btcGetBlockTxIdsAsync(blockHeight)
  console.log(txArray)
} catch (error) {
  console.error(error.message)
}
```

### Split BTC Outputs

Divides or consolidates your unspent outputs to the number of outputs you set, equally distributing BTC, and returning the transaction id and final output count. If the resulting balance per output is less that 10000 satoshi, the number of outputs will be decreased until the balance per output exceeds that value.

```js
let privateKeyWIF = '91aFbdjd1Xj3VbXQg8rKsj5BQ8iYX1oncC3p5evRKsxXkEfnjg8' // for deriving keyPair used in transaction creation
let maxOutputs = 6 // the desired number of outputs 
let feeTotalSatoshi = 39000 // the total fee paid for this transaction, in satoshi

let splitResult
try {
  splitResult = await anchor.btcSplitOutputsAsync(privateKeyWIF, maxOutputs, feeTotalSatoshi)
  console.log(`New transaction id = ${splitResult.txId}`)
  console.log(`Output count = ${splitResult.count}`)
} catch (error) {
  console.error(error.message)
}
```

### Confirm ETH

Confirm your hex string data has been embedded into an Ethereum transaction, returning true or false.

```js
var transactionId = 'b61b35f6f274663c4a1c062174925b97dc705cbfca9bd704e91c7d352f709e9c' // the transaction id to inspect for the anchored value
var expectedValue = 'a6ec80e2000000000000000000000000e6a4f92579facb4026096f017243ee839ff72fd1' // the hex data string value to verify is anchored within the transaction
// Optionally, transactionId and expectedValue may begin with '0x' for all Ethereum functions

let confirmed
try {
  confirmed = await anchor.ethConfirmDataAsync(transactionId, expectedValue)
  console.log(confirmed)
} catch (error) {
  console.error(error.message)
}
```
