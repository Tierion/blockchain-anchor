const _ = require('lodash')
const rp = require('request-promise-native')

module.exports = {
  getUnspentOutputsAsync: async (address, serviceOptions) => {
    let targetUrl = `https://api.blockcypher.com/v1/btc/${(serviceOptions.btcUseTestnet ? 'test3' : 'main')}/addrs/${address}?token=${serviceOptions.blockcypherToken}&unspentOnly=1`

    let options = {
      method: 'GET',
      url: targetUrl,
      resolveWithFullResponse: true
    }

    let response
    try {
      response = await rp(options)
    } catch (error) {
      if (error.statusCode) throw new Error(`Invalid response : ${error.statusCode} : ${JSON.parse(error.error).error}`)
      throw new Error(`No response received on getUnspentOutputsAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    console.log(apiResult)
    if (apiResult.error) throw new Error(apiResult.error)

    let unspentOutputs = []
    console.log(apiResult.txrefs)
    _(apiResult.txrefs).each((output) => {
      unspentOutputs.push({
        fromTxHash: output.tx_hash,
        outputIndex: output.tx_output_n,
        amountSatoshi: output.value
      })
    })
    if (apiResult.unconfirmed_txrefs) {
      _(apiResult.unconfirmed_txrefs).each((output) => {
        unspentOutputs.push({
          fromTxHash: output.tx_hash,
          outputIndex: output.tx_output_n,
          amountSatoshi: output.value
        })
      })
    }
    return unspentOutputs
  },

  pushTransactionAsync: async (transactionHex, serviceOptions) => {
    let options = {
      method: 'POST',
      url: `https://api.blockcypher.com/v1/btc/${(serviceOptions.btcUseTestnet ? 'test3' : 'main')}/txs/push?token=${serviceOptions.blockcypherToken}`,
      headers: { 'Content-Type': 'application/json' },
      json: { 'tx': transactionHex },
      resolveWithFullResponse: true
    }

    let response
    try {
      response = await rp(options)
    } catch (error) {
      if (error.statusCode) throw new Error(`Invalid response : ${error.statusCode} : ${JSON.parse(error.error).error}`)
      throw new Error(`No response received on pushTransactionAsync : ${error.message}`)
    }

    let apiResult = response.body
    if (apiResult.error) throw new Error(apiResult.error)

    return apiResult.tx.hash
  },

  confirmOpReturnAsync: async (transactionId, expectedValue, serviceOptions) => {
    let targetUrl = `https://api.blockcypher.com/v1/btc/${(serviceOptions.btcUseTestnet ? 'test3' : 'main')}/txs/${transactionId}?token=${serviceOptions.blockcypherToken}`

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
    if (apiResult.error) throw new Error(apiResult.error)

    let resultMessage = false
    if (apiResult.outputs) {
      _(apiResult.outputs).each((output) => {
        if (output.script_type === 'null-data' && output.data_hex === expectedValue) {
          resultMessage = true
          return false
        }
      })
    }
    return resultMessage
  },

  confirmBTCBlockHeaderAsync: async (blockHeight, expectedValue, serviceOptions) => {
    let targetUrl = `https://api.blockcypher.com/v1/btc/${(serviceOptions.btcUseTestnet ? 'test3' : 'main')}/blocks/${blockHeight}?token=${serviceOptions.blockcypherToken}`

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
    if (apiResult.error) throw new Error(apiResult.error)

    let resultMessage = false
    if (apiResult.mrkl_root === expectedValue) {
      resultMessage = true
    }
    return resultMessage
  },

  getBTCTransactionConfirmationCountAsync: async (transactionId, serviceOptions) => {
    let targetUrl = `https://api.blockcypher.com/v1/btc/${(serviceOptions.btcUseTestnet ? 'test3' : 'main')}/txs/${transactionId}?token=${serviceOptions.blockcypherToken}`

    let options = {
      method: 'GET',
      url: targetUrl,
      resolveWithFullResponse: true
    }

    let response
    try {
      response = await rp(options)
    } catch (error) {
      if (error.statusCode) throw new Error(`Invalid response : ${error.statusCode} : ${JSON.parse(error.error).error}`)
      throw new Error(`No response received on getBTCTransactionConfirmationCountAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (apiResult.error) throw new Error(apiResult.error)

    return apiResult.confirmations
  },

  getBTCBlockTxIdsAsync: async (blockHeight, serviceOptions) => {
    let baseUrl = `https://api.blockcypher.com/v1/btc/${(serviceOptions.btcUseTestnet ? 'test3' : 'main')}/blocks/${blockHeight}?token=${serviceOptions.blockcypherToken}`
    let limit = 500
    let start = 0

    let firstSegmentUrl = `${baseUrl}&txstart=${start}&limit=${limit}`

    let options = {
      method: 'GET',
      url: firstSegmentUrl,
      resolveWithFullResponse: true
    }

    let response
    try {
      response = await rp(options)
    } catch (error) {
      if (error.statusCode) throw new Error(`Invalid response : ${error.statusCode} : ${JSON.parse(error.error).error}`)
      throw new Error(`No response received on getBTCBlockTxIdsAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (apiResult.error) throw new Error(apiResult.error)

    let txCount = apiResult.n_tx
    let txIds = apiResult.txids
    if (txCount <= limit) return txIds // we have all the txids, return them

    // create segment list for subsequest calls to get complete list of txids
    let segments = []
    for (let x = limit; x < txCount; x += limit) {
      segments.push(x)
    }

    for (let index in segments) {
      let currentSegmentUrl = `${baseUrl}&txstart=${segments[index]}&limit=${limit}`

      let options = {
        method: 'GET',
        url: currentSegmentUrl,
        resolveWithFullResponse: true
      }

      let response
      try {
        response = await rp(options)
      } catch (error) {
        if (error.statusCode) throw new Error(`Invalid response : ${error.statusCode} : ${JSON.parse(error.error).error}`)
        throw new Error(`No response received on getBTCBlockTxIdsAsync : ${error.message}`)
      }

      let apiResult = JSON.parse(response.body)
      if (apiResult.error) throw new Error(apiResult.error)

      let segmentTxIds = apiResult.txids
      txIds = txIds.concat(segmentTxIds)
    }
    return txIds
  },

  confirmEthDataAsync: async (transactionId, expectedValue, serviceOptions) => {
    let targetUrl = `https://api.blockcypher.com/v1/eth/main/txs/${transactionId}?token=${serviceOptions.blockcypherToken}`

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
      throw new Error(`No response received on confirmEthDataAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (apiResult.error) throw new Error(apiResult.error)

    let resultMessage = false
    if (apiResult.outputs) {
      _(apiResult.outputs).each((output) => {
        if (output.script === expectedValue) {
          resultMessage = true
          return false
        }
      })
    }
    return resultMessage
  }
}
