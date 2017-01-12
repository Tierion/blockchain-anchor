/*jslint node: true */
'use strict';

var _ = require('lodash');
var request = require('request');
var async = require('async');

module.exports = {
    getUnspentOutputs: function (address, useTestnet, token, callback) {
        var targetUrl = 'https://api.blockcypher.com/v1/btc/' + (useTestnet ? 'test3' : 'main') + '/addrs/' + address + '?token=' + token + '&unspentOnly=1';

        request.get({
            url: targetUrl
        }, function (err, res, body) {
            if (err) return callback(err);
            if (res.statusCode != 200) return callback(body);
            var apiResult = JSON.parse(body);
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
        });
    },
    pushTransaction: function (transactionHex, useTestnet, token, callback) {
        request.post({
            url: 'https://api.blockcypher.com/v1/btc/' + (useTestnet ? 'test3' : 'main') + '/txs/push?token=' + token,
            headers: { 'Content-Type': 'application/json' },
            json: { 'tx': transactionHex }
        }, function (err, res, body) {
            if (err) return callback(err);
            if (res.statusCode != 201) return callback(body);
            if (body.error) {
                callback(body.error);
            } else {
                callback(null, body.tx.hash);
            }
        });
    },
    confirmOpReturn: function (transactionId, expectedValue, useTestnet, token, callback) {
        var targetUrl = 'https://api.blockcypher.com/v1/btc/' + (useTestnet ? 'test3' : 'main') + '/txs/' + transactionId + '?token=' + token;

        request.get({
            url: targetUrl
        }, function (err, res, body) {
            if (err) return callback(res.error);
            if (res.statusCode != 200) return callback(null, false); // received response, but transactionid was bad or not found, return false 
            var apiResult = JSON.parse(body);
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
        });

    },
    confirmEthData: function (transactionId, expectedValue, token, callback) {
        var targetUrl = 'https://api.blockcypher.com/v1/eth/main/txs/' + transactionId;
        if (token) targetUrl += ('?token=' + token);

        request.get({
            url: targetUrl
        }, function (err, res, body) {
            if (err) return callback(res.error);
            if (res.statusCode != 200) return callback(null, false); // received response, but transactionid was bad or not found, return false 
            var apiResult = JSON.parse(body);
            if (apiResult.error) {
                callback(apiResult.error);
            } else {
                var resultMessage = false;
                if (apiResult.outputs) {
                    _(apiResult.outputs).each(function (output) {
                        if (output.script == expectedValue) {
                            resultMessage = true;
                            return false;
                        }
                    });
                }
                callback(null, resultMessage);
            }
        });

    },
    confirmBTCBlockHeader: function (blockHeight, expectedValue, useTestnet, token, callback) {
        var targetUrl = 'https://api.blockcypher.com/v1/btc/' + (useTestnet ? 'test3' : 'main') + '/blocks/' + blockHeight + '?token=' + token;

        request.get({
            url: targetUrl
        }, function (err, res, body) {
            if (err) return callback(res.error);
            if (res.statusCode != 200) return callback(null, false); // received response, but blockHeight was bad or not found, return false 
            var apiResult = JSON.parse(body);
            if (apiResult.error) {
                callback(apiResult.error);
            } else {
                var resultMessage = false;
                if (apiResult.mrkl_root == expectedValue) {
                    resultMessage = true;
                }
                callback(null, resultMessage);
            }
        });

    },

    getBTCTransactionConfirmationCount: function (transactionId, useTestnet, token, callback) {
        var targetUrl = 'https://api.blockcypher.com/v1/btc/' + (useTestnet ? 'test3' : 'main') + '/txs/' + transactionId + '?token=' + token;

        request.get({
            url: targetUrl
        }, function (err, res, body) {
            if (err) return callback(res.error);
            if (res.statusCode != 200) return callback(res.statusCode);
            var apiResult = JSON.parse(body);
            if (apiResult.error) {
                callback(apiResult.error);
            } else {
                callback(null, apiResult.confirmations);
            }
        });

    },

    getBTCBlockTxIds: function (blockHeight, useTestnet, token, callback) {
        var baseUrl = 'https://api.blockcypher.com/v1/btc/' + (useTestnet ? 'test3' : 'main') + '/blocks/' + blockHeight + '?token=' + token;
        var limit = 500;
        var start = 0;

        var firstSegmentUrl = baseUrl + '&txstart=' + start + '&limit=' + limit;

        request.get({
            url: firstSegmentUrl
        }, function (err, res, body) {
            if (err) return callback(res.error);
            if (res.statusCode != 200) return callback(res.statusCode);
            var apiResult = JSON.parse(body);
            if (apiResult.error) {
                callback(apiResult.error);
            } else {
                var txCount = apiResult.n_tx;
                var txIds = apiResult.txids;
                if (txCount <= limit) return callback(null, txIds); // we have all the txids, return them

                // create segment list for subsequest calls to get complete list of txids
                var segments = [];
                for (var x = limit; x < txCount; x += limit) {
                    segments.push(x);
                }

                async.eachSeries(segments, function (segment, segmentCallback) {
                    var currentSegmentUrl = baseUrl + '&txstart=' + segment + '&limit=' + limit;

                    request.get({
                        url: currentSegmentUrl
                    }, function (err, res, body) {
                        if (err) return segmentCallback(res.error);
                        if (res.statusCode != 200) return segmentCallback(res.statusCode);
                        var apiResult = JSON.parse(body);
                        if (apiResult.error) {
                            return segmentCallback(apiResult.error);
                        } else {
                            var segmentTxIds = apiResult.txids;
                            txIds = txIds.concat(segmentTxIds);
                            return segmentCallback(null);
                        }
                    });
                }, function (err) {
                    if (err) return callback(err);
                    return callback(null, txIds);
                });

            }
        });

    }
};