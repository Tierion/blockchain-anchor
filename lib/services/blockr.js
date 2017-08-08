const _ = require('lodash')
const rp = require('request-promise-native')

module.exports = {
  getUnspentOutputsAsync: async (address, serviceOptions) => {
    let targetUrl = `https://${(serviceOptions.btcUseTestnet ? 'tbtc' : 'btc')}.blockr.io/api/v1/address/unspent/${address}?unconfirmed=1`

    let options = {
      method: 'GET',
      url: targetUrl,
      resolveWithFullResponse: true
    }

    let response
    try {
      response = await rp(options)
    } catch (error) {
      if (error.statusCode) throw new Error(`Invalid response : ${error.statusCode} : ${error.message}`)
      throw new Error(`No response received on getUnspentOutputsAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (apiResult.status !== 'success') throw new Error(apiResult.error)

    let unspentOutputs = []
    _(apiResult.data.unspent).each((output) => {
      unspentOutputs.push({
        fromTxHash: output.tx,
        outputIndex: output.n,
        amountSatoshi: Math.round(output.amount * 100000000)
      })
    })

    return unspentOutputs
  },

  pushTransactionAsync: async (transactionHex, serviceOptions) => {
    let options = {
      method: 'POST',
      url: `https://${(serviceOptions.btcUseTestnet ? 'tbtc' : 'btc')}.blockr.io/api/v1/tx/push`,
      headers: { 'Content-Type': 'application/json' },
      json: { 'hex': transactionHex },
      resolveWithFullResponse: true
    }

    let response
    try {
      response = await rp(options)
    } catch (error) {
      if (error.statusCode) throw new Error(`Invalid response : ${error.statusCode} : ${error.message}`)
      throw new Error(`No response received on pushTransactionAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (apiResult.status !== 'success') throw new Error(apiResult.error)

    return apiResult.data
  },

  confirmOpReturnAsync: async (transactionId, expectedValue, serviceOptions) => {
    let targetUrl = `https://${(serviceOptions.btcUseTestnet ? 'tbtc' : 'btc')}.blockr.io/api/v1/tx/info/${transactionId}`

    let options = {
      method: 'GET',
      url: targetUrl,
      resolveWithFullResponse: true
    }

    let response
    try {
      response = await rp(options)
    } catch (error) {
      if (error.statusCode) return false // received response, but transactionid was bad or not found, return false
      throw new Error(`No response received on confirmOpReturnAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (apiResult.status !== 'success') throw new Error(apiResult.error)

    let resultMessage = false
    if (apiResult.data.vouts) {
      _(apiResult.data.vouts).each((output) => {
        if (output.extras) {
          if (output.extras.type === 'nulldata' && output.extras.asm === `OP_RETURN ${expectedValue}`) {
            resultMessage = true
            return false
          }
        }
      })
    }
    return resultMessage
  },

  confirmBTCBlockHeaderAsync: async (blockHeight, expectedValue, serviceOptions) => {
    let targetUrl = `https://${(serviceOptions.btcUseTestnet ? 'tbtc' : 'btc')}.blockr.io/api/v1/block/info/${blockHeight}`

    let options = {
      method: 'GET',
      url: targetUrl,
      resolveWithFullResponse: true
    }

    let response
    try {
      response = await rp(options)
    } catch (error) {
      if (error.statusCode) return false // received response, but blockheight was bad or not found, return false
      throw new Error(`No response received on confirmBTCBlockHeaderAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (apiResult.status !== 'success') throw new Error(apiResult.error)

    let resultMessage = false
    if (apiResult.data.merkleroot === expectedValue) {
      resultMessage = true
    }
    return resultMessage
  },

  getBTCTransactionConfirmationCountAsync: async (transactionId, serviceOptions) => {
    let targetUrl = `https://${(serviceOptions.btcUseTestnet ? 'tbtc' : 'btc')}.blockr.io/api/v1/tx/info/${transactionId}`

    let options = {
      method: 'GET',
      url: targetUrl,
      resolveWithFullResponse: true
    }

    let response
    try {
      response = await rp(options)
    } catch (error) {
      if (error.statusCode) throw new Error(`Invalid response : ${error.statusCode} : ${error.message}`)
      throw new Error(`No response received on getBTCTransactionConfirmationCountAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (apiResult.status !== 'success') throw new Error(apiResult.error)

    return apiResult.data.confirmations
  },

  getBTCBlockTxIdsAsync: async (blockHeight, serviceOptions) => {
    let targetUrl = `https://${(serviceOptions.btcUseTestnet ? 'tbtc' : 'btc')}.blockr.io/api/v1/block/raw/${blockHeight}`

    let options = {
      method: 'GET',
      url: targetUrl,
      resolveWithFullResponse: true
    }

    let response
    try {
      response = await rp(options)
    } catch (error) {
      if (error.statusCode) throw new Error(`Invalid response : ${error.statusCode} : ${error.message}`)
      throw new Error(`No response received on getBTCBlockTxIdsAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (apiResult.status !== 'success') throw new Error(apiResult.error)

    return apiResult.data.tx
  }
}
