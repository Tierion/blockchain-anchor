"use strict";

var async = require('async');
var bitcoin = require('bitcoinjs-lib');
var _ = require('lodash');
var utils = require('./helpers/utils.js');

var SERVICES = ['blockcypher', 'blockr', 'insightbitpay'];

class BlockchainAnchor {
    constructor(privateKeyWIF, useTestnet, blockchainServiceName, feeSatoshi) {    
        // when useTestnet set to true, TestNet is used, otherwise defaults to Mainnet
        this.network = useTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
        this.useTestnet = useTestnet;
    
        // get keyPair for the supplied privateKeyWIF
        this.keyPair = bitcoin.ECPair.fromWIF(privateKeyWIF, this.network);
    
        // derive target address from the keyPair
        this.address = this.keyPair.getAddress();
    
        // check for valid blockchainServiceName, if not, set to Any    
        blockchainServiceName = (blockchainServiceName || '').toLowerCase();
        this.blockchainServiceName = SERVICES.indexOf(blockchainServiceName) > -1 ? blockchainServiceName : 'Any';
    
        // check for feeSatoshi, default to 10000 if not defined
        this.feeSatoshi = feeSatoshi || 10000;
    }
    
    ////////////////////////////////////////////
    // PUBLIC functions
    ////////////////////////////////////////////

    embed(hexData, callback) {
        if (this.blockchainServiceName != 'Any') // a specific service was chosen, attempt once with that service
        {
            pushEmbedTx(this.blockchainServiceName, this.address, this.keyPair, this.feeSatoshi, hexData, this.useTestnet, function (err, result) {
                if (err) { // error pushing transaction onto the network, throw exception
                    throw new Error(err);
                } else { // success pushing transaction onto network, return the transactionId
                    callback(result);
                }
            });
        } else { // use the first service option, continue with the next option upon failure until all have been attempted
            var errors = [];
            var txId = 0;
            var that = this;

            async.forEachSeries(SERVICES, function (blockchainServiceName, servicesCallback) {
                pushEmbedTx(blockchainServiceName, that.address, that.keyPair, that.feeSatoshi, hexData, that.useTestnet, function (err, result) {
                    if (err) { // error pushing transaction onto the network, throw exception
                        errors.push(err);
                        servicesCallback();
                    } else { // success pushing transaction onto network, return the transactionId
                        txId = result;
                        servicesCallback(true); // sending true, indicating success, as an error to break out of the foreach loop
                    }
                });
            }, function (success) {
                if (!success) { // none of the services returned successfully, throw exception
                    throw new Error(errors.join('\n'));
                } else { // a service has succeeded and returned a new transactionId, return that id to caller
                    callback(txId);
                }
            });
        }
    }

    splitOutputs(maxOutputs) {
        var result;
        if (this.blockchainServiceName != 'Any') // a specific service was chosen, attempt once with that service
        {
            result = pushSplitOutputsTx(this.blockchainServiceName, this.address, maxOutputs, this.useTestnet);
            if (result.hasError) { // error pushing transaction onto the network, throw exception
                throw result.message;
            } else { // success pushing transaction onto network, return the transactionId
                return result.txId;
            }
        } else { // use the first service option, continue with the next option upon failure until all have been attempted
            var errors = [];
            var txId = 0;
            var useTestnet = this.useTestnet;

            _(SERVICES).each(function (blockchainServiceName) {
                result = pushSplitOutputsTx(blockchainServiceName, this.address, maxOutputs, useTestnet);
                if (result.hasError) { // error pushing transaction onto the network, add exception to error array
                    errors.push(result.message);
                } else { // success pushing transaction onto network, set the transactionId and return false to break foreach
                    txId = result.txId;
                    return false;
                }
            });

            if (txId == 0) { // none of the services returned successfully, throw exception
                throw errors.join('\n');
            } else { // a service has succeeded and returned a new transactionId, return that id to caller
                return txId;
            }
        }
    }

    confirm(transactionId, expectedValue, callback) {
        if (this.blockchainServiceName != 'Any') // a specific service was chosen, attempt once with that service
        {
            confirmOpReturn(this.blockchainServiceName, transactionId, expectedValue, this.useTestnet, function (err, result) {
                if (err) { // error pushing transaction onto the network, throw exception
                    throw new Error(err);
                } else { // success pushing transaction onto network, return the transactionId
                    callback(result);
                }
            });
        } else { // use the first service option, continue with the next option upon failure until all have been attempted
            var errors = [];
            var isConfirmed = null;
            var that = this;

            async.forEachSeries(SERVICES, function (blockchainServiceName, servicesCallback) {
                confirmOpReturn(blockchainServiceName, transactionId, expectedValue, that.useTestnet, function (err, result) {
                    if (err) { // error pushing transaction onto the network, throw exception
                        errors.push(err);
                        servicesCallback();
                    } else { // success pushing transaction onto network, return the transactionId
                        isConfirmed = result;
                        servicesCallback(true); // sending true, indicating success, as an error to break out of the foreach loop
                    }
                });
            }, function (success) {
                if (!success) { // none of the services returned successfully, throw exception
                    throw new Error(errors.join('\n'));
                } else { // a service has succeeded and returned a new transactionId, return that id to caller
                    callback(isConfirmed);
                }
            });


        }
    }

}

////////////////////////////////////////////
// PRIVATE functions
////////////////////////////////////////////

function pushEmbedTx(blockchainServiceName, address, keyPair, feeSatoshi, hexData, useTestnet, callback) {
    // get an instacne of the selected service
    var blockchainService = utils.getBlockchainService(blockchainServiceName);

    async.waterfall([
        function (wfCallback) {
            blockchainService.getUnspentOutputs(address, useTestnet, function (err, unspentOutputs) {
                if (err) {
                    wfCallback(err);
                } else {
                    wfCallback(null, unspentOutputs);
                }
            });
        },
        function (unspentOutputs, wfCallback) {
            var spendableOutput = _.orderBy(unspentOutputs, 'amountSatoshi', 'desc')[0];
            if (!spendableOutput) {
                wfCallback('No unspent outputs available, balance likely 0');
            } else if (spendableOutput.amountSatoshi < feeSatoshi) {
                wfCallback('No outputs with sufficient funds available');
            } else {
                var tx = new bitcoin.TransactionBuilder(useTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin);
                tx.addInput(spendableOutput.fromTxHash, spendableOutput.outputIndex);

                var buffer = new Buffer(hexData, 'hex');
                var dataScript = bitcoin.script.nullDataOutput(buffer);
                tx.addOutput(dataScript, 0);

                var spendableAmountSatoshi = spendableOutput.amountSatoshi;
                var returnAmountSatoshi = spendableAmountSatoshi - feeSatoshi;
                tx.addOutput(address, returnAmountSatoshi);

                tx.sign(0, keyPair);

                var transactionHex = tx.build().toHex();

                blockchainService.pushTransaction(transactionHex, useTestnet, function (err, transactionId) {
                    if (err) {
                        wfCallback(err);
                    } else {
                        wfCallback(null, transactionId);
                    }
                });
            }
        }
    ], function (err, result) {
        callback(err, result);
    });
}

function pushSplitOutputsTx(blockchainServiceName, address, maxOutputs, useTestnet) {
    // get an instacne of the selected service
    var blockchainService = utils.getBlockchainService(blockchainServiceName);
    
    // get an array of the unspent outputs
    var unspentResult = blockchainService.getUnspentOutputs(address, useTestnet);
    if (unspentResult.hasError) return { hasError: true, message: unspentResult.message };

    return { hasError: false, message: 'success', txId: '123456789' };
}

function confirmOpReturn(blockchainServiceName, transactionId, expectedValue, useTestnet, callback) {
    // get an instacne of the selected service
    var blockchainService = utils.getBlockchainService(blockchainServiceName);
    blockchainService.confirmOpReturn(transactionId, expectedValue, useTestnet, function (err, result) {
        callback(err, result);
    });
}

module.exports = function (privateKeyWIF, useTestnet, blockchainServiceName, feeSatoshi) {
    return new BlockchainAnchor(privateKeyWIF, useTestnet, blockchainServiceName, feeSatoshi);
};