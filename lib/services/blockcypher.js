/* Copyright 2017 Tierion
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*     http://www.apache.org/licenses/LICENSE-2.0
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

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
    if (apiResult.error) throw new Error(apiResult.error)

    let unspentOutputs = []
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
      if (error.statusCode) throw new Error(`Invalid response : ${error.statusCode} : ${JSON.parse(error.error).error}`)
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

  confirmBTCBlockHeaderAsync: async (blockHeightOrHash, expectedValue, serviceOptions) => {
    let targetUrl = `https://api.blockcypher.com/v1/btc/${(serviceOptions.btcUseTestnet ? 'test3' : 'main')}/blocks/${blockHeightOrHash}?token=${serviceOptions.blockcypherToken}`

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

  getBTCTransactionStatsAsync: async (transactionId, serviceOptions) => {
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
      throw new Error(`No response received on getBTCTransactionStatsAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (apiResult.error) throw new Error(apiResult.error)

    let txStats = {}
    txStats.id = apiResult.hash
    txStats.blockHeight = apiResult.block_height
    txStats.blockHash = apiResult.block_hash
    txStats.confirmations = apiResult.confirmations
    txStats.feeSatoshi = apiResult.fees
    txStats.sizeBytes = apiResult.size

    if (apiResult.outputs) {
      _(apiResult.outputs).each((output) => {
        if (output.script_type === 'null-data') {
          txStats.opReturn = output.data_hex
        }
      })
    }

    return txStats
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

  getBTCBlockStatsAsync: async (blockHeightOrHash, serviceOptions) => {
    let baseUrl = `https://api.blockcypher.com/v1/btc/${(serviceOptions.btcUseTestnet ? 'test3' : 'main')}/blocks/${blockHeightOrHash}?token=${serviceOptions.blockcypherToken}`
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
      throw new Error(`No response received on getBTCBlockStatsAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (apiResult.error) throw new Error(apiResult.error)

    let blockStats = {}
    blockStats.hash = apiResult.hash
    blockStats.height = apiResult.height
    blockStats.merkleRoot = apiResult.mrkl_root
    blockStats.txIds = apiResult.txids
    blockStats.time = Date.parse(apiResult.time) / 1000

    let txCount = apiResult.n_tx
    if (txCount <= limit) return blockStats // we have all the txids, return blockStats

    // create segment list for subsequest calls to get complete list of txids
    let segments = []
    for (let x = limit; x < txCount; x += limit) {
      segments.push(x)
    }

    for (let index = 0; index < segments.length; index++) {
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
        throw new Error(`No response received on getBTCBlockStatsAsync : ${error.message}`)
      }

      let apiResult = JSON.parse(response.body)
      if (apiResult.error) throw new Error(apiResult.error)

      let segmentTxIds = apiResult.txids
      blockStats.txIds = blockStats.txIds.concat(segmentTxIds)
    }
    return blockStats
  },

  getBTCBlockTxIdsAsync: async (blockHeightOrHash, serviceOptions) => {
    let baseUrl = `https://api.blockcypher.com/v1/btc/${(serviceOptions.btcUseTestnet ? 'test3' : 'main')}/blocks/${blockHeightOrHash}?token=${serviceOptions.blockcypherToken}`
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

    for (let index = 0; index < segments.length; index++) {
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

  getEstimatedFeeRateSatPerByteAsync: async (serviceOptions) => {
    let targetUrl = `https://api.blockcypher.com/v1/btc/${(serviceOptions.btcUseTestnet ? 'test3' : 'main')}?token=${serviceOptions.blockcypherToken}`

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
      throw new Error(`No response received on getEstimatedFeeRateSatPerByteAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (apiResult.error) throw new Error(apiResult.error)

    let feeRateSatPerKb = apiResult.high_fee_per_kb
    if (feeRateSatPerKb <= 0) throw new Error(`Invalid estimated fee value received: ${feeRateSatPerKb}`)
    let feeRateSatPerByte = Math.ceil(feeRateSatPerKb / 1024)

    return feeRateSatPerByte
  },

  confirmEthDataAsync: async (transactionId, expectedValue, serviceOptions) => {
    // extract '0x' if present
    if (transactionId.startsWith('0x')) transactionId = transactionId.substr(2)
    if (expectedValue.startsWith('0x')) expectedValue = expectedValue.substr(2)

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
      if (error.statusCode) throw new Error(`Invalid response : ${error.statusCode} : ${JSON.parse(error.error).error}`)
      throw new Error(`No response received on confirmEthDataAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (apiResult.error) throw new Error(apiResult.error)

    let resultMessage = false
    if (apiResult.outputs) {
      _(apiResult.outputs).each((output) => {
        if (output.script.includes(expectedValue)) {
          resultMessage = true
          return false
        }
      })
    }
    return resultMessage
  }
}
