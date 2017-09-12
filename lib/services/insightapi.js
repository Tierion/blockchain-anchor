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
      if (error.statusCode) throw new Error(`Invalid response : ${error.statusCode} : ${error.error}`)
      throw new Error(`No response received on confirmOpReturnAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (apiResult.error) throw new Error(apiResult.error)
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

  confirmBTCBlockHeaderAsync: async (blockHeightOrHash, expectedValue, serviceOptions) => {
    // test if the provided blockHeightOrHash is a hash
    // if it is not a hash, assume it is a height, and attempt to find the hash for that height
    // otherwise, skip this step and proceed with the given blockHash
    let isHash = /^[0-9a-f]{64}$/i.test(blockHeightOrHash)
    if (!isHash) {
      let targetUrl = `${serviceOptions.insightApiBase}/block-index/${blockHeightOrHash}`

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

      blockHeightOrHash = apiResult.blockHash
    }

    let targetUrl = `${serviceOptions.insightApiBase}/block/${blockHeightOrHash}`
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
      throw new Error(`No response received on confirmBTCBlockHeaderAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (apiResult.error) throw new Error(apiResult.error)

    let resultMessage = false
    if (apiResult.merkleroot === expectedValue) {
      resultMessage = true
    }
    return resultMessage
  },

  getBTCTransactionStatsAsync: async (transactionId, serviceOptions) => {
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
      throw new Error(`No response received on getBTCTransactionStatsAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (apiResult.error) throw new Error(apiResult.error)

    let txStats = {}
    txStats.id = apiResult.txid
    txStats.blockHeight = apiResult.blockheight
    txStats.blockHash = apiResult.blockhash
    txStats.confirmations = apiResult.confirmations
    txStats.feeSatoshi = apiResult.fees * 100000000
    txStats.sizeBytes = apiResult.size

    return txStats
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
    if (apiResult.error) throw new Error(apiResult.error)

    return apiResult.confirmations
  },

  getBTCBlockStatsAsync: async (blockHeightOrHash, serviceOptions) => {
    // test if the provided blockHeightOrHash is a hash
    // if it is not a hash, assume it is a height, and attempt to find the hash for that height
    // otherwise, skip this step and proceed with the given blockHash
    let isHash = /^[0-9a-f]{64}$/i.test(blockHeightOrHash)
    if (!isHash) {
      let targetUrl = `${serviceOptions.insightApiBase}/block-index/${blockHeightOrHash}`

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
        throw new Error(`No response received on getBTCBlockStatsAsync : ${error.message}`)
      }

      let apiResult = JSON.parse(response.body)
      if (apiResult.error) throw new Error(apiResult.error)

      blockHeightOrHash = apiResult.blockHash
    }

    let targetUrl = `${serviceOptions.insightApiBase}/block/${blockHeightOrHash}`

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
      throw new Error(`No response received on getBTCBlockStatsAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (apiResult.error) throw new Error(apiResult.error)

    let blockStats = {}
    blockStats.hash = apiResult.hash
    blockStats.height = apiResult.height
    blockStats.merkleRoot = apiResult.merkleroot
    blockStats.txIds = apiResult.tx
    blockStats.time = apiResult.time

    return blockStats
  },

  getBTCBlockTxIdsAsync: async (blockHeightOrHash, serviceOptions) => {
    // test if the provided blockHeightOrHash is a hash
    // if it is not a hash, assume it is a height, and attempt to find the hash for that height
    // otherwise, skip this step and proceed with the given blockHash
    let isHash = /^[0-9a-f]{64}$/i.test(blockHeightOrHash)
    if (!isHash) {
      let targetUrl = `${serviceOptions.insightApiBase}/block-index/${blockHeightOrHash}`

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

      blockHeightOrHash = apiResult.blockHash
    }

    let targetUrl = `${serviceOptions.insightApiBase}/block/${blockHeightOrHash}`

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

    let txIds = apiResult.tx

    return txIds
  },

  getEstimatedFeeRateSatPerByteAsync: async (serviceOptions) => {
    let targetUrl = `${serviceOptions.insightApiBase}/utils/estimatefee?nbBlocks=2`

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
      throw new Error(`No response received on getEstimatedFeeRateSatPerByteAsync : ${error.message}`)
    }

    let apiResult = JSON.parse(response.body)
    if (apiResult.error) throw new Error(apiResult.error)

    let feeRateBTCPerKb = apiResult['2']
    if (feeRateBTCPerKb <= 0) throw new Error(`Invalid estimated fee value received: ${feeRateBTCPerKb}`)
    let feeRateSatPerByte = Math.ceil(feeRateBTCPerKb * 100000000 / 1024)

    return feeRateSatPerByte
  },

  confirmEthDataAsync: async (transactionId, expectedValue, serviceOptions) => {
    throw new Error('Eth functions not supported in insightapi service')
  }
}
