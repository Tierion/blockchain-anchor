# blockchain-anchor

[![npm](https://img.shields.io/npm/l/blockchain-anchor.svg)](https://www.npmjs.com/package/blockchain-anchor)
[![npm](https://img.shields.io/npm/v/blockchain-anchor.svg)](https://www.npmjs.com/package/blockchain-anchor)

A Node.js library for anchoring data onto the Bitcoin blockchain and confirming anchored data on Bitcoin and Ethereum.

## Installation

```
$ npm install --save blockchain-anchor
```

### Create BlockchainAnchor Object

```js
var blockchainAnchor = require('blockchain-anchor');

var privateKeyWIF = '91sdjjXQfj5ncC3YXg8d1Xjg8rK1oxXnp5BQ8iskE3aFbevRKVb';
var anchorOptions = {
  useTestnet: true, // optional, defaults to false
  blockchainServiceName: 'blockcypher', // optional, defaults to 'Any'
  blockcypherToken: '6e61883832ea7fb4308994386a4157b5', // required if using 'blockcypher' service
  feeSatoshi: 10000 // optional, defaults to 10000
};

var anchor = new blockchainAnchor(privateKeyWIF, anchorOptions); // privateKeyWIF and anchorOptions are optional
//If you omit the privateKeyWIF parameter, you will be unable to perform Embed or SplitOutputs tasks, and an error will be thrown. 
//Omitting privateKeyWIF is useful for when you only need to perform Confirm tasks, as they are a readonly function not requiring key pairs or signing.
```
Bitcoin anchor data is included in a transaction's OP_RETURN output. Ethereum anchor data is included in the transaction's data payload. 

This module uses a set of 3rd party APIs to read and write data from the Bitcoin and Ethereum blockchains. When working with Bitcoin, the acceptable values for 'blockchainServiceName' are blockcypher, blockr, insightapi, or any. If a specific service is chosen, then only that service will be used. If 'any' is chosen, then all services will be used, starting with one, and moving to the next in the event of failure. If you wish to use blockcypher, be sure to include a valid blockcypher token. These optional parameters are not needed when confirming Ethereum anchors.



## Usage

### Embed

Embed your hex string data into the blockchain, and receive a Bitcoin transaction id as a response.

```js
var hexData = '05ae04314577b2783b4be98211d1b72476c59e9c413cfb2afa2f0c68e0d93911';

anchor.embed(hexData, function (err, transactionId, rawTransaction) {
  if(err) {
    // do something
  } else {
    console.log('New transaction Id = ' + transactionId);
    console.log('Raw tx = ' + rawTransaction);
  }
});
```

### Confirm

Confirm your hex string data has been embedded into a Bitcoin transaction, returning true or false.

```js
var txId = '048ac54c4313dc6980cace9fac533d71f8fe5cad881f1271329b98183231a08f';
var hexData = '05ae04314577b2783b4be98211d1b72476c59e9c413cfb2afa2f0c68e0d93911';

anchor.confirm(txId, hexData, function (err, result) {
  if(err) {
    // do something
  } else {
    console.log('Transaction contains data? ' + result);
  }
});
```

### ConfirmEth

Confirm your hex string data has been embedded into an Ethereum transaction, returning true or false.

```js
var txId = 'd3e7ec84c3dbe86f7d9a8ea68ae4ded6c0b012be519f433a07f15bd612fb47a9';
var hexData = '2b10349367c46a91c485abca4f7834454118d631f28996fb2908a0fe8cefa0cd';

anchor.confirmEth(txId, hexData, function (err, result) {
  if(err) {
    // do something
  } else {
    console.log('Transaction contains data? ' + result);
  }
});
```

### ConfirmBTCBlockHeader

Confirm your hex string data equals the merkle root of the given BTC block, returning true or false.

```js
var blockHeight = 435821;
var hexData = '2b10349367c46a91c485abca4f7834454118d631f28996fb2908a0fe8cefa0cd';

anchor.confirmBTCBlockHeader(blockHeight, hexData, function (err, result) {
  if(err) {
    // do something
  } else {
    console.log('Transaction contains data? ' + result);
  }
});
```

### Split Outputs

Divides or consolidates your unspent outputs to an amount you set, returning a transaction id. If the resulting balance per output is less that 10000 satoshi, the number of outputs will be decreased until the balance per output exceeds that value.

```js

var maxOutputs = 10;

anchor.splitOutputs(maxOutputs, function (err, result) {
  if(err) {
    // do something
  } else {
    console.log('New transaction Id = ' + result);
  }
});
```
