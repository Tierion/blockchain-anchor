var _ = require('lodash');
var unirest = require('unirest');

module.exports = {
    getUnspentOutputs: function (address, useTestnet, token, callback) {
        var targetUrl = 'https://api.blockcypher.com/v1/btc/' + (useTestnet ? 'test3' : 'main') + '/addrs/' + address + '?token=' + token + '&unspentOnly=1';

        unirest.get(targetUrl).end(function (result) {
            if (result.error) {
                callback(result.error);
            } else {
                var apiResult = result.body;
                if (apiResult.error) {
                    callback(apiResult.error);
                } else {
                    var unspentOutputs = [];
                    _(apiResult.txrefs).each(function (output) {
                        unspentOutputs.push({
                            fromTxHash: output.tx_hash,
                            outputIndex: output.tx_output_n,
                            amountSatoshi: output.value
                        });
                    });
                    if (apiResult.unconfirmed_txrefs) {
                        _(apiResult.unconfirmed_txrefs).each(function (output) {
                            unspentOutputs.push({
                                fromTxHash: output.tx_hash,
                                outputIndex: output.tx_output_n,
                                amountSatoshi: output.value
                            });
                        });
                    }
                    callback(null, unspentOutputs);
                }
            }
        });
    },
    pushTransaction: function (transactionHex, useTestnet, token, callback) {
        unirest.post('https://api.blockcypher.com/v1/btc/' + (useTestnet ? 'test3' : 'main') + '/txs/push?token=' + token)
            .header('Content-Type', 'application/json')
            .send({ 'tx': transactionHex })
            .end(function (result) {
                if (result.error) {
                    callback(result.error);
                } else {
                    var apiResult = result.body;
                    if (apiResult.error) {
                        callback(apiResult.error);
                    } else {
                        callback(null, apiResult.tx.hash);
                    }
                }
            });
    },
    confirmOpReturn: function (transactionId, expectedValue, useTestnet, token, callback) {
        var targetUrl = 'https://api.blockcypher.com/v1/btc/' + (useTestnet ? 'test3' : 'main') + '/txs/' + transactionId + '?token=' + token;

        unirest.get(targetUrl).end(function (result) {
            if (result.error) {
                if (result.statusType == 4) { // received response, but transactionid was bad or not found, return false 
                    callback(null, false);
                    return;
                }
                callback(result.error);
            } else {
                var apiResult = result.body;
                if (apiResult.error) {
                    callback(apiResult.error);
                } else {
                    var resultMessage = false;
                    if (apiResult.outputs) {
                        _(apiResult.outputs).each(function (output) {
                            if (output.script_type == 'null-data' && output.data_hex == expectedValue) {
                                resultMessage = true;
                                return false;
                            }
                        });
                    }
                    callback(null, resultMessage);
                }
            }
        });
    }
};