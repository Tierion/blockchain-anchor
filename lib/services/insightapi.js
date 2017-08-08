const _ = require('lodash')
const rp = require('request-promise-native')

module.exports = {
  getUnspentOutputsAsync: async (address, serviceOptions) => {
    let targetUrl = `${serviceOptions.insightApiBase}/addr/${address}/utxo?noCache=1`

    let options = {
      method: 'GET',
      url: targetUrl,
      resolveWithFullResponse: true
    }

    let response
    try {
      response = await rp(options)
    } catch (error) {
      if (error.statusCode) throw new Error(`Invalid response : ${error.statusCode} : ${error.error}`)
      throw new Error(`No response received on getUnspentOutputsAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    let unspentOutputs = []
    _(apiResult).each((output) => {
      if (output.txid && (output.vout !== null) && output.amount) {
        unspentOutputs.push({
          fromTxHash: output.txid,
          outputIndex: output.vout,
          amountSatoshi: Math.round(output.amount * 100000000)
        })
      }
    })

    return unspentOutputs
  },

  pushTransactionAsync: async (transactionHex, serviceOptions) => {
    let options = {
      method: 'POST',
      url: `${serviceOptions.insightApiBase}/tx/send`,
      headers: { 'Content-Type': 'application/json' },
      json: { 'rawtx': transactionHex },
      resolveWithFullResponse: true
    }

    let response
    try {
      response = await rp(options)
    } catch (error) {
      if (error.statusCode) throw new Error(`Invalid response : ${error.statusCode} : ${error.error}`)
      throw new Error(`No response received on pushTransactionAsync : ${error.message}`)
    }
    if (!response.body.txid) throw new Error('Could not push to blockchain')

    return response.body.txid
  },

  confirmOpReturnAsync: async (transactionId, expectedValue, serviceOptions) => {
    let targetUrl = `${serviceOptions.insightApiBase}/tx/${transactionId}`

    let options = {
      method: 'GET',
      url: targetUrl,
      resolveWithFullResponse: true
    }

    let response
    try {
      response = await rp(options)
    } catch (error) {
      if (error.statusCode) return false // received response, but tx was bad or not found, return false
      throw new Error(`No response received on confirmOpReturnAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (!apiResult.txid) throw new Error(apiResult.error)
    let resultMessage = false
    if (apiResult.vout) {
      _(apiResult.vout).each((output) => {
        if (output.scriptPubKey) {
          if (output.scriptPubKey.asm === `OP_RETURN ${expectedValue}`) {
            resultMessage = true
            return false // break from .each loop
          }
        }
      })
    }
    return resultMessage
  },

  confirmBTCBlockHeaderAsync: async (blockHeight, expectedValue, serviceOptions) => {
    let targetUrl = `${serviceOptions.insightApiBase}/block-index/${blockHeight}`

    let options = {
      method: 'GET',
      url: targetUrl,
      resolveWithFullResponse: true
    }

    let response
    try {
      response = await rp(options)
    } catch (error) {
      if (error.statusCode) return false // received response, but blockHeight was bad or not found, return false
      throw new Error(`No response received on confirmBTCBlockHeaderAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (!apiResult.blockHash) throw new Error(apiResult.error)

    targetUrl = `${serviceOptions.insightApiBase}/block/${apiResult.blockHash}`
    options = {
      method: 'GET',
      url: targetUrl,
      resolveWithFullResponse: true
    }

    try {
      response = await rp(options)
    } catch (error) {
      if (error.statusCode) return false // received response, but blockHash was bad or not found, return false
      throw new Error(`No response received on confirmBTCBlockHeaderAsync : ${error.message}`)
    }

    apiResult = JSON.parse(response.body)
    if (!apiResult.merkleroot) throw new Error(apiResult.error)

    let resultMessage = false
    if (apiResult.merkleroot === expectedValue) {
      resultMessage = true
    }
    return resultMessage
  },

  getBTCTransactionConfirmationCountAsync: async (transactionId, serviceOptions) => {
    let targetUrl = `${serviceOptions.insightApiBase}/tx/${transactionId}`

    let options = {
      method: 'GET',
      url: targetUrl,
      resolveWithFullResponse: true
    }

    let response
    try {
      response = await rp(options)
    } catch (error) {
      if (error.statusCode) throw new Error(`Invalid response : ${error.statusCode} : ${error.error}`)
      throw new Error(`No response received on getBTCTransactionConfirmationCountAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (!apiResult.txid) throw new Error(apiResult.error)

    return apiResult.confirmations
  },

  getBTCBlockTxIdsAsync: async (blockHeight, serviceOptions) => {
    let targetUrl = `${serviceOptions.insightApiBase}/block-index/${blockHeight}`

    let options = {
      method: 'GET',
      url: targetUrl,
      resolveWithFullResponse: true
    }

    let response
    try {
      response = await rp(options)
    } catch (error) {
      if (error.statusCode) throw new Error(`Invalid response : ${error.statusCode} : ${error.error}`)
      throw new Error(`No response received on getBTCBlockTxIdsAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (apiResult.error) throw new Error(apiResult.error)

    let blockHash = apiResult.blockHash

    targetUrl = `${serviceOptions.insightApiBase}/block/${blockHash}`

    options = {
      method: 'GET',
      url: targetUrl,
      resolveWithFullResponse: true
    }

    try {
      response = await rp(options)
    } catch (error) {
      if (error.statusCode) throw new Error(`Invalid response : ${error.statusCode} : ${error.error}`)
      throw new Error(`No response received on getBTCBlockTxIdsAsync : ${error.message}`)
    }

    apiResult = JSON.parse(response.body)
    if (apiResult.error) throw new Error(apiResult.error)

    let txIds = apiResult.tx

    return txIds
  },

  confirmEthDataAsync: async (transactionId, expectedValue, serviceOptions) => {
    throw new Error('Eth functions not supported in insightapi service')
  }
}
