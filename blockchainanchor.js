/*jslint node: true */
'use strict';

var async = require('async');
var bitcoin = require('bitcoinjs-lib');
var _ = require('lodash');
var utils = require('./helpers/utils.js');

var SERVICES = ['blockcypher', 'insightbitpay', 'blockr'];

var BlockchainAnchor = function (privateKeyWIF, anchorOptions) {
    // in case 'new' was omitted
    if (!(this instanceof BlockchainAnchor)) {
        return new BlockchainAnchor(privateKeyWIF, anchorOptions);
    }

    var network = bitcoin.networks.bitcoin;
    var useTestnet = false;
    var keyPair = null;
    var address = null;
    var blockchainServiceName = 'Any';
    var feeSatoshi = 10000;
    var blockcypherToken = null;
    var keyProvided = false;

    if (anchorOptions) { //if anchor optiosn were supplied, then process them
        // when useTestnet set to true, TestNet is used, otherwise defaults to Mainnet
        if (anchorOptions.useTestnet !== undefined) {
            useTestnet = anchorOptions.useTestnet;
            network = anchorOptions.useTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
        }

        // check for valid blockchainServiceName, if not, default to Any
        if (anchorOptions.blockchainServiceName !== undefined) {
            anchorOptions.blockchainServiceName = anchorOptions.blockchainServiceName.toLowerCase();
            if (SERVICES.indexOf(anchorOptions.blockchainServiceName) > -1) blockchainServiceName = anchorOptions.blockchainServiceName;
        }

        // check for feeSatoshi, default to 10000 if not defined
        if (anchorOptions.feeSatoshi >= 0) feeSatoshi = anchorOptions.feeSatoshi;

        if (anchorOptions.blockcypherToken !== undefined) {
            blockcypherToken = anchorOptions.blockcypherToken;
        }
    }

    // blockcypher token was not supplied, so remove from available services
    if (blockcypherToken === null) {
        _.remove(SERVICES, function (x) {
            return x == 'blockcypher';
        });
    }

    if (privateKeyWIF) {
        // get keyPair for the supplied privateKeyWIF
        keyPair = bitcoin.ECPair.fromWIF(privateKeyWIF, network);
        // derive target address from the keyPair
        address = keyPair.getAddress();
        keyProvided = true;
    }

    ////////////////////////////////////////////
    // PUBLIC functions
    ////////////////////////////////////////////

    this.embed = function (hexData, callback) {
        if (!keyProvided) throw 'No privateKeyWIF was provided';
        if (blockchainServiceName != 'Any') // a specific service was chosen, attempt once with that service
        {
            _pushEmbedTx(blockchainServiceName, hexData, function (err, result) {
                if (err) { // error pushing transaction onto the network, return exception
                    callback(err);
                } else { // success pushing transaction onto network, return the transactionId
                    callback(null, result);
                }
            });
        } else { // use the first service option, continue with the next option upon failure until all have been attempted
            var errors = [];
            var txId = 0;

            async.forEachSeries(SERVICES, function (blockchainServiceName, servicesCallback) {
                _pushEmbedTx(blockchainServiceName, hexData, function (err, result) {
                    if (err) { // error pushing transaction onto the network, return exception
                        errors.push(err);
                        servicesCallback();
                    } else { // success pushing transaction onto network, return the transactionId
                        txId = result;
                        servicesCallback(true); // sending true, indicating success, as an error to break out of the foreach loop
                    }
                });
            }, function (success) {
                if (!success) { // none of the services returned successfully, return exception
                    callback(errors.join('\n'));
                } else { // a service has succeeded and returned a new transactionId, return that id to caller
                    callback(null, txId);
                }
            });
        }
    };

    this.splitOutputs = function (maxOutputs, callback) {
        if (!keyProvided) throw 'No privateKeyWIF was provided';
        if (blockchainServiceName != 'Any') // a specific service was chosen, attempt once with that service
        {
            _pushSplitOutputsTx(blockchainServiceName, maxOutputs, function (err, result) {
                if (err) { // error pushing transaction onto the network, return exception
                    callback(err);
                } else { // success pushing transaction onto network, return the transactionId
                    callback(null, result);
                }
            });
        } else { // use the first service option, continue with the next option upon failure until all have been attempted
            var errors = [];
            var txId = 0;

            async.forEachSeries(SERVICES, function (blockchainServiceName, servicesCallback) {
                _pushSplitOutputsTx(blockchainServiceName, maxOutputs, function (err, result) {
                    if (err) { // error pushing transaction onto the network, return exception
                        errors.push(err);
                        servicesCallback();
                    } else { // success pushing transaction onto network, return the transactionId
                        txId = result;
                        servicesCallback(true); // sending true, indicating success, as an error to break out of the foreach loop
                    }
                });
            }, function (success) {
                if (!success) { // none of the services returned successfully, return exception
                    callback(errors.join('\n'));
                } else { // a service has succeeded and returned a new transactionId, return that id to caller
                    callback(null, txId);
                }
            });
        }
    };

    this.confirm = function (transactionId, expectedValue, callback) {
        if (blockchainServiceName != 'Any') // a specific service was chosen, attempt once with that service
        {
            _confirmOpReturn(blockchainServiceName, transactionId, expectedValue, function (err, result) {
                if (err) { // error pushing transaction onto the network, return exception
                    callback(err);
                } else { // success pushing transaction onto network, return the transactionId
                    callback(null, result);
                }
            });
        } else { // use the first service option, continue with the next option upon failure until all have been attempted
            var errors = [];
            var isConfirmed = null;

            async.forEachSeries(SERVICES, function (blockchainServiceName, servicesCallback) {
                _confirmOpReturn(blockchainServiceName, transactionId, expectedValue, function (err, result) {
                    if (err) { // error pushing transaction onto the network, return exception
                        errors.push(err);
                        servicesCallback();
                    } else { // success pushing transaction onto network, return the transactionId
                        isConfirmed = result;
                        servicesCallback(true); // sending true, indicating success, as an error to break out of the foreach loop
                    }
                });
            }, function (success) {
                if (!success) { // none of the services returned successfully, return exception
                    callback(errors.join('\n'));
                } else { // a service has succeeded and returned a new transactionId, return that id to caller
                    callback(null, isConfirmed);
                }
            });


        }
    };

    this.confirmEth = function (transactionId, expectedValue, callback) {
        _confirmEthData(transactionId, expectedValue, function (err, result) {
            if (err) { // error pushing transaction onto the network, return exception
                callback(err);
            } else { // success pushing transaction onto network, return the transactionId
                callback(null, result);
            }
        });
    };

    this.confirmBTCBlockHeader = function (blockHeight, expectedValue, callback) {
        if (blockchainServiceName != 'Any') // a specific service was chosen, attempt once with that service
        {
            _confirmBTCBlockHeader(blockchainServiceName, blockHeight, expectedValue, function (err, result) {
                if (err) { // error pushing transaction onto the network, return exception
                    callback(err);
                } else { // success pushing transaction onto network, return the transactionId
                    callback(null, result);
                }
            });
        } else { // use the first service option, continue with the next option upon failure until all have been attempted
            var errors = [];
            var isConfirmed = null;

            async.forEachSeries(SERVICES, function (blockchainServiceName, servicesCallback) {
                _confirmBTCBlockHeader(blockchainServiceName, blockHeight, expectedValue, function (err, result) {
                    if (err) { // error pushing transaction onto the network, return exception
                        errors.push(err);
                        servicesCallback();
                    } else { // success pushing transaction onto network, return the transactionId
                        isConfirmed = result;
                        servicesCallback(true); // sending true, indicating success, as an error to break out of the foreach loop
                    }
                });
            }, function (success) {
                if (!success) { // none of the services returned successfully, return exception
                    callback(errors.join('\n'));
                } else { // a service has succeeded and returned a new transactionId, return that id to caller
                    callback(null, isConfirmed);
                }
            });


        }
    };

    //////////////////////////////////////////
    //  Private Utility functions
    //////////////////////////////////////////

    function _pushEmbedTx(serviceName, hexData, callback) {
        // get an instance of the selected service
        var blockchainService = utils.getBlockchainService(serviceName);

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
        console.log(transactionHex);

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

    function _pushSplitOutputsTx(serviceName, maxOutputs, callback) {
        // get an instacnce of the selected service
        var blockchainService = utils.getBlockchainService(serviceName);

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
                var totalBalanceSatoshi = _.sumBy(unspentOutputs, function (x) { return x.amountSatoshi; }); // value of all unspent outputs
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

                for (x = 0; x < tx.inputs.length; x++) {
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

    function _confirmOpReturn(serviceName, transactionId, expectedValue, callback) {
        // get an instance of the selected service
        var blockchainService = utils.getBlockchainService(serviceName);
        blockchainService.confirmOpReturn(transactionId, expectedValue, useTestnet, blockcypherToken, function (err, result) {
            callback(err, result);
        });
    }

    function _confirmEthData(transactionId, expectedValue, callback) {
        // get an instance of the selected service
        var blockchainService = utils.getBlockchainService('blockcypher');
        blockchainService.confirmEthData(transactionId, expectedValue, blockcypherToken, function (err, result) {
            callback(err, result);
        });
    }

    function _confirmBTCBlockHeader(serviceName, blockHeight, expectedValue, callback) {
        // get an instance of the selected service
        var blockchainService = utils.getBlockchainService(serviceName);
        blockchainService.confirmBTCBlockHeader(blockHeight, expectedValue, useTestnet, blockcypherToken, function (err, result) {
            callback(err, result);
        });
    }

};

module.exports = BlockchainAnchor;