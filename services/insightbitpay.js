'use strict'

var _ = require('lodash')
var request = require('request')

module.exports = {
  getUnspentOutputs: function (address, useTestnet, token, callback) {
    var targetUrl = 'https://' + (useTestnet ? 'test-' : '') + 'insight.bitpay.com/api/addr/' + address + '/utxo?noCache=1'

    request.get({
      url: targetUrl
    }, function (err, res, body) {
      if (err) return callback(err)
      if (res.statusCode !== 200) return callback(body)
      var apiResult = JSON.parse(body)
      var unspentOutputs = []
      _(apiResult).each(function (output) {
        if (output.txid && (output.vout !== null) && output.amount) {
          unspentOutputs.push({
            fromTxHash: output.txid,
            outputIndex: output.vout,
            amountSatoshi: Math.round(output.amount * 100000000)
          })
        }
      })
      callback(null, unspentOutputs)
    })
  },
  pushTransaction: function (transactionHex, useTestnet, token, callback) {
    request.post({
      url: 'https://' + (useTestnet ? 'test-' : '') + 'insight.bitpay.com/api/tx/send',
      headers: { 'Content-Type': 'application/json' },
      json: { 'rawtx': transactionHex }
    }, function (err, res, body) {
      if (err) return callback(err)
      if (res.statusCode !== 200) return callback(body)
      if (!body.txid) {
        callback('Could not push to blockchain')
      } else {
        callback(null, body.txid)
      }
    })
  },
  confirmOpReturn: function (transactionId, expectedValue, useTestnet, token, callback) {
    var targetUrl = 'https://' + (useTestnet ? 'test-' : '') + 'insight.bitpay.com/api/tx/' + transactionId

    request.get({
      url: targetUrl
    }, function (err, res, body) {
      if (err) return callback(res.error)
      if (res.statusCode !== 200) return callback(null, false) // received response, but transactionid was bad or not found, return false
      var apiResult = JSON.parse(body)
      if (!apiResult.txid) {
        callback(apiResult.error)
      } else {
        var resultMessage = false
        if (apiResult.vout) {
          _(apiResult.vout).each(function (output) {
            if (output.scriptPubKey) {
              if (output.scriptPubKey.asm === 'OP_RETURN ' + expectedValue) {
                resultMessage = true
                return false
              }
            }
          })
        }
        callback(null, resultMessage)
      }
    })
  },
  confirmBTCBlockHeader: function (blockHeight, expectedValue, useTestnet, token, callback) {
    var targetUrl = 'https://' + (useTestnet ? 'test-' : '') + 'insight.bitpay.com/api/block-index/' + blockHeight

    request.get({
      url: targetUrl
    }, function (err, res, body) {
      if (err) return callback(res.error)
      if (res.statusCode !== 200) return callback(null, false) // received response, but blockHeight was bad or not found, return false
      var apiResult = JSON.parse(body)
      if (!apiResult.blockHash) {
        callback(apiResult.error)
      } else {
        var targetUrl = 'https://' + (useTestnet ? 'test-' : '') + 'insight.bitpay.com/api/block/' + apiResult.blockHash
        request.get({
          url: targetUrl
        }, function (err, res, body) {
          if (err) return callback(res.error)
          if (res.statusCode !== 200) return callback(null, false) // received response, but blockHash was bad or not found, return false
          var apiResult = JSON.parse(body)
          if (!apiResult.merkleroot) {
            callback(apiResult.error)
          } else {
            var resultMessage = false
            if (apiResult.merkleroot === expectedValue) {
              resultMessage = true
            }
            callback(null, resultMessage)
          }
        })
      }
    })
  },

  getBTCTransactionConfirmationCount: function (transactionId, useTestnet, token, callback) {
    var targetUrl = 'https://' + (useTestnet ? 'test-' : '') + 'insight.bitpay.com/api/tx/' + transactionId

    request.get({
      url: targetUrl
    }, function (err, res, body) {
      if (err) return callback(res.error)
      if (res.statusCode !== 200) return callback(null, false) // received response, but transactionid was bad or not found, return false
      var apiResult = JSON.parse(body)
      if (!apiResult.txid) {
        callback(apiResult.error)
      } else {
        callback(null, apiResult.confirmations)
      }
    })
  },

  getBTCBlockTxIds: function (blockHeight, useTestnet, token, callback) {
    callback('not implemented')
  }
}
