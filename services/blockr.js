var _ = require('lodash');
var unirest = require('unirest');

module.exports = {
    getUnspentOutputs: function (address, useTestnet, callback) {
        var targetUrl = 'https://' + (useTestnet ? 'tbtc' : 'btc') + '.blockr.io/api/v1/address/unspent/' + address + '?unconfirmed=1';

        unirest.get(targetUrl).end(function (result) {
            if (result.error) {
                callback(result.error);
            } else {
                var apiResult = result.body;
                if (apiResult.status != 'success') {
                    callback(apiResult.error);
                } else {
                    var unspentOutputs = [];
                    _(apiResult.data.unspent).each(function (output) {
                        unspentOutputs.push({
                            fromTxHash: output.tx,
                            outputIndex: output.n,
                            amountSatoshi: output.amount * 100000000
                        });
                    });
                    callback(null, unspentOutputs);
                }
            }
        });
    },
    pushTransaction: function (transactionHex, useTestnet, callback) {
        unirest.post('https://' + (useTestnet ? 'tbtc' : 'btc') + '.blockr.io/api/v1/tx/push')
            .header('Content-Type', 'application/json')
            .send({ 'hex': transactionHex })
            .end(function (result) {
                if(result.error) {
                    callback(result.error);
                } else {
                    var apiResult = result.body;
                    if(apiResult.status != 'success') {
                        callback(apiResult.data);
                    } else {
                        callback(null, apiResult.data);
                    }                    
                }                
            });
    },
    confirmOpReturn: function (transactionId, expectedValue, useTestnet, callback) {
        var targetUrl = 'http://' + (useTestnet ? 'tbtc' : 'btc') + '.blockr.io/api/v1/tx/info/' + transactionId;

        unirest.get(targetUrl).end(function (result) {
            if (result.error) {
                if (result.statusType == 4) { // received response, but transactionid was bad or not found, return false 
                    callback(null, false);
                    return;
                }
                callback(result.error);
            } else {
                var apiResult = result.body;
                if (apiResult.status != 'success') {
                    callback(apiResult.error);
                } else {
                    var resultMessage = false;
                    if (apiResult.data.vouts) {
                        _(apiResult.data.vouts).each(function (output) {
                            if (output.extras) {
                                if (output.extras.type == 'nulldata' && output.extras.asm == 'OP_RETURN ' + expectedValue) {
                                    resultMessage = true;
                                    return false;
                                }
                            }
                        });
                    }
                    callback(null, resultMessage);
                }
            }
        });
    }
};