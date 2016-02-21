"use strict";

var async = require('async');
var bitcoin = require('bitcoinjs-lib');
var _ = require('lodash');
var utils = require('./helpers/utils.js');

var SERVICES = ['blockcypher', 'blockr', 'insightbitpay'];

class BlockchainAnchor {
    constructor(privateKeyWIF, useTestnet, blockchainServiceName, feeSatoshi, blockcypherToken) {    
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
        
        this.blockcypherToken = blockcypherToken;
        if(!blockcypherToken) { // blockcypher token was not supplied, so remove from available services and abort if that is the service specified 
            _.remove(SERVICES, function(x) {
                return x == 'blockcypher';
            });
            if(blockchainServiceName == 'blockcypher') {
                throw new Error('Token is required in order to use blockcypher service.')
            }
        }
    }
    
    ////////////////////////////////////////////
    // PUBLIC functions
    ////////////////////////////////////////////

    embed(hexData, callback) {
        if (this.blockchainServiceName != 'Any') // a specific service was chosen, attempt once with that service
        {
            pushEmbedTx(this.blockchainServiceName, this.address, this.keyPair, this.feeSatoshi, hexData, this.useTestnet, this.blockcypherToken, function (err, result) {
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
                pushEmbedTx(blockchainServiceName, that.address, that.keyPair, that.feeSatoshi, hexData, that.useTestnet, that.blockcypherToken, function (err, result) {
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

    splitOutputs(maxOutputs, callback) {
        if (this.blockchainServiceName != 'Any') // a specific service was chosen, attempt once with that service
        {
            pushSplitOutputsTx(this.blockchainServiceName, this.address, this.keyPair, maxOutputs, this.feeSatoshi, this.useTestnet, this.blockcypherToken, function (err, result) {
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
                pushSplitOutputsTx(that.blockchainServiceName, that.address, that.keyPair, maxOutputs, that.feeSatoshi, that.useTestnet, that.blockcypherToken, function (err, result) {
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

    confirm(transactionId, expectedValue, callback) {
        if (this.blockchainServiceName != 'Any') // a specific service was chosen, attempt once with that service
        {
            confirmOpReturn(this.blockchainServiceName, transactionId, expectedValue, this.useTestnet, this.blockcypherToken, function (err, result) {
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
                confirmOpReturn(blockchainServiceName, transactionId, expectedValue, that.useTestnet, that.blockcypherToken, function (err, result) {
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

function pushEmbedTx(blockchainServiceName, address, keyPair, feeSatoshi, hexData, useTestnet, blockcypherToken, callback) {
    // get an instance of the selected service
    var blockchainService = utils.getBlockchainService(blockchainServiceName);

    async.waterfall([
        function (wfCallback) {
            blockchainService.getUnspentOutputs(address, useTestnet, blockcypherToken, function (err, unspentOutputs) {
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

                blockchainService.pushTransaction(transactionHex, useTestnet, blockcypherToken, function (err, transactionId) {
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

function pushSplitOutputsTx(blockchainServiceName, address, keyPair, maxOutputs, feeSatoshi, useTestnet, blockcypherToken, callback) {
    // get an instacnce of the selected service
    var blockchainService = utils.getBlockchainService(blockchainServiceName);

    async.waterfall([
        function (wfCallback) {
            blockchainService.getUnspentOutputs(address, useTestnet, blockcypherToken, function (err, unspentOutputs) {
                if (err) {
                    wfCallback(err);
                } else {
                    wfCallback(null, unspentOutputs);
                }
            });
        },
        function (unspentOutputs, wfCallback) {
            var newOutputCount = maxOutputs;
            var totalBalanceSatoshi = _.sumBy(unspentOutputs, function (x) { return x.amountSatoshi }); // value of all unspent outputs
            var workingBalanceSatoshi = totalBalanceSatoshi - feeSatoshi; // deduct the fee, the remainder is to be divided amongst the outputs
            var perOutputAmountSatoshi = _.floor(workingBalanceSatoshi / newOutputCount); // amount for each output
            while (perOutputAmountSatoshi < 10000) {
                if (--newOutputCount < 1) {
                    wfCallback('Not enough funds to complete transaction');
                    return;
                }
                perOutputAmountSatoshi = workingBalanceSatoshi / newOutputCount;
            }

            var tx = new bitcoin.TransactionBuilder(useTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin);

            _(unspentOutputs).forEach(function (spendableOutput) {
                tx.addInput(spendableOutput.fromTxHash, spendableOutput.outputIndex);
            });

            for (var x = 0; x < newOutputCount; x++) {
                tx.addOutput(address, perOutputAmountSatoshi);
            }

            for (var x = 0; x < tx.inputs.length; x++) {
                tx.sign(x, keyPair);
            }

            var transactionHex = tx.build().toHex();

            blockchainService.pushTransaction(transactionHex, useTestnet, blockcypherToken, function (err, transactionId) {
                if (err) {
                    wfCallback(err);
                } else {
                    wfCallback(null, transactionId);
                }
            }); 
        }
    ], function (err, result) {
        callback(err, result);
    });
}

function confirmOpReturn(blockchainServiceName, transactionId, expectedValue, useTestnet, blockcypherToken, callback) {
    // get an instance of the selected service
    var blockchainService = utils.getBlockchainService(blockchainServiceName);
    blockchainService.confirmOpReturn(transactionId, expectedValue, useTestnet, blockcypherToken, function (err, result) {
        callback(err, result);
    });
}

module.exports = function (privateKeyWIF, useTestnet, blockchainServiceName, feeSatoshi, blockcypherToken) {
    return new BlockchainAnchor(privateKeyWIF, useTestnet, blockchainServiceName, feeSatoshi, blockcypherToken);
};