var _ = require('lodash');
var config = require('../config.js');
var unirest = require('unirest');

module.exports = {
    getUnspentOutputs: function (address) {
        return { hasError: true, message: 'not implemented - BC' };
    },
    pushTransaction: function (transaction) {
        return { hasError: true, message: 'not implemented - BC' };
    },
    confirmOpReturn: function (transactionId, expectedValue) {
        var targetUrl = 'https://api.blockcypher.com/v1/btc/main/txs/' + transactionId + '?token=' + config.blockcypherToken;

        unirest.get(targetUrl).end(function (result) {
            if (result.error) {
                return { hasError: true, message: result.error };
            } else {
                var apiResult = result.body;
                if(apiResult.error) {
                    return { hasError: true, message: apiResult.error };
                } else {
                    var resultMessage = false;
                    if(apiResult.outputs)
                    {
                        _(apiResult.outputs).each(function(output) {
                            if(output.script_type == 'null-data' && output.data_hex == expectedValue) {
                                resultMessage = true;
                                return false;
                            }
                        });
                    }
                    return { hasError: false, message: resultMessage };
                }
            }
        });
    }
};