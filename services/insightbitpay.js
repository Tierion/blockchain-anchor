var _ = require('lodash');
var unirest = require('unirest');

module.exports = {
    getUnspentOutputs: function (address, useTestnet, token, callback) {
        var targetUrl = 'https://' + (useTestnet ? 'test-' : '') + 'insight.bitpay.com/api/addr/' + address + '/utxo?noCache=1';

        unirest.get(targetUrl).end(function (result) {
            if (result.error) {
                callback(result.error);
            } else {
                var apiResult = result.body;
                var unspentOutputs = [];
                _(apiResult).each(function (output) {
                    if (output.txid && output.vout && output.amount) {
                        unspentOutputs.push({
                            fromTxHash: output.txid,
                            outputIndex: output.vout,
                            amountSatoshi: output.amount * 100000000
                        });
                    }
                });
                callback(null, unspentOutputs);
            }
        });
    },
    pushTransaction: function (transactionHex, useTestnet, token, callback) {
        unirest.post('https://' + (useTestnet ? 'test-' : '') + 'insight.bitpay.com/api/tx/send')
            .header('Content-Type', 'application/json')
            .send({ 'rawtx': transactionHex })
            .end(function (result) {
                if(result.error) {
                    callback(result.error);
                } else {
                    var apiResult = result.body;
                    if(!apiResult.txid) {
                        callback('Could not push to blockchain');
                    } else {
                        callback(null, apiResult.txid);
                    }                    
                }                
            });
    },
    confirmOpReturn: function (transactionId, expectedValue, useTestnet, token, callback) {
        var targetUrl = 'https://' + (useTestnet ? 'test-' : '') + 'insight.bitpay.com/api/tx/' + transactionId;

        unirest.get(targetUrl).end(function (result) {
            if (result.error) {
                if (result.statusType == 4) { // received response, but transactionid was bad or not found, return false 
                    callback(null, false);
                    return;
                }
                callback(result.error);
            } else {
                var apiResult = result.body;
                if (!apiResult.txid) {
                    callback(apiResult.error);
                } else {
                    var resultMessage = false;
                    if (apiResult.vout) {
                        _(apiResult.vout).each(function (output) {
                            if (output.scriptPubKey) {
                                if (output.scriptPubKey.type == 'nulldata' && output.scriptPubKey.asm == 'OP_RETURN ' + expectedValue) {
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