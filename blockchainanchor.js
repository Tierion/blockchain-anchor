const bitcoin = require('bitcoinjs-lib')
const _ = require('lodash')
const utils = require('./lib/utils.js')

let AVAILABLE_SERVICES = ['insightapi', 'blockcypher']
let SERVICES_TO_USE = []

let BlockchainAnchor = function (anchorOptions) {
  // in case 'new' was omitted
  if (!(this instanceof BlockchainAnchor)) {
    return new BlockchainAnchor(anchorOptions)
  }

  // set default btc network to mainnet
  let btcUseTestnet = false
  let btcNetwork = bitcoin.networks.bitcoin
  // when btcUseTestnet set to true, testnet is to be used, otherwise defaults to mainnet
  if (anchorOptions && anchorOptions.btcUseTestnet !== undefined) {
    btcUseTestnet = anchorOptions.btcUseTestnet
    btcNetwork = anchorOptions.btcUseTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin
  }

  // set default sevice selection to 'any', allowing for retrying across services
  if (!anchorOptions || anchorOptions.service === undefined || anchorOptions.service === 'any') {
    SERVICES_TO_USE = AVAILABLE_SERVICES.slice(0)
  }
  // if a specific service is chosen, set that as the sole service, provided it is valid
  if (anchorOptions && anchorOptions.service !== undefined && anchorOptions.service !== 'any') {
    let serviceLowercase = anchorOptions.service.toLowerCase()
    if (AVAILABLE_SERVICES.indexOf(serviceLowercase) > -1) {
      SERVICES_TO_USE.push(serviceLowercase)
    } else {
      throw new Error(`Unknown service : ${anchorOptions.service}`)
    }
  }

  let defaultInsightApiBase = `https://${(btcUseTestnet ? 'test-' : '')}insight.bitpay.com/api`
  let customInsightApiBase = null
  // if insightApiBase is supplied, override default bitpay instance
  // be sure that the btcUseTestnet setting matches the configuration of the custom insight-api instance...
  // if the instance at insightApiBase is testnet, you must set btcUseTestnet to true, otherwise methods will fail
  if (anchorOptions && anchorOptions.insightApiBase !== undefined) {
    customInsightApiBase = anchorOptions.insightApiBase
    // If insightapi service will be used, and custom uri was also supplied, add that to the services list
    if (anchorOptions.service === undefined || anchorOptions.service === 'any' || anchorOptions.service === 'insightapi') SERVICES_TO_USE.unshift('custom-insightapi')
    // if a custom insightapi is used, and you do not want to auto fallback to the default in case of failure, remove from list
    if (!anchorOptions.insightFallback) _.remove(SERVICES_TO_USE, (x) => { return x === 'insightapi' })
  }

  let blockcypherToken = null
  // check for blockcypherToken
  if (anchorOptions && anchorOptions.blockcypherToken !== undefined) {
    blockcypherToken = anchorOptions.blockcypherToken
  }
  if (!blockcypherToken) {
    // if no token was supplied, but blockcypher service was requested, throw error
    if (anchorOptions && anchorOptions.service === 'blockcypher') throw new Error(`Requested blockcypher, but missing blockcypherToken`)
    // if no token was supplied, but other services avialable, remove from services to use
    _.remove(SERVICES_TO_USE, (x) => { return x === 'blockcypher' })
  }
  /// /////////////////////////////////////////
  // PUBLIC functions
  /// /////////////////////////////////////////

  // BTC functions

  this.btcOpReturnAsync = async (privateKeyWIF, hexData, feeTotalSat) => {
    if (!privateKeyWIF) throw new Error('No privateKeyWIF was provided')
    let keyPair, address
    try {
      // get keyPair for the supplied privateKeyWIF
      keyPair = bitcoin.ECPair.fromWIF(privateKeyWIF, btcNetwork)
      // derive target address from the keyPair
      address = keyPair.getAddress()
    } catch (error) {
      throw new Error(`Bad privateKeyWIF : ${error.message}`)
    }

    let txResults
    let errors = []
    let success = false
    for (let index in SERVICES_TO_USE) {
      try {
        txResults = await _embedAsync(SERVICES_TO_USE[index], hexData, address, keyPair, feeTotalSat)
        success = true
        break
      } catch (error) {
        errors.push(error.message)
      }
    }
    // if none of the services returned successfully, throw error
    if (!success) throw new Error(errors)
    return txResults
  }

  this.btcSplitOutputsAsync = async (privateKeyWIF, maxOutputs, feeTotalSat) => {
    if (!privateKeyWIF) throw new Error('No privateKeyWIF was provided')
    let keyPair, address
    try {
      // get keyPair for the supplied privateKeyWIF
      keyPair = bitcoin.ECPair.fromWIF(privateKeyWIF, btcNetwork)
      // derive target address from the keyPair
      address = keyPair.getAddress()
    } catch (error) {
      throw new Error(`Bad privateKeyWIF : ${error.message}`)
    }

    let txResults
    let errors = []
    let success = false
    for (let index in SERVICES_TO_USE) {
      try {
        txResults = await _pushSplitOutputsTxAsync(SERVICES_TO_USE[index], maxOutputs, address, keyPair, feeTotalSat)
        success = true
        break
      } catch (error) {
        errors.push(error.message)
      }
    }
    // if none of the services returned successfully, throw error
    if (!success) throw new Error(errors)
    return txResults
  }

  this.btcConfirmOpReturnAsync = async (transactionId, expectedValue) => {
    let confirmed = false
    let errors = []
    let success = false
    for (let index in SERVICES_TO_USE) {
      try {
        confirmed = await _confirmOpReturnAsync(SERVICES_TO_USE[index], transactionId, expectedValue)
        success = true
        break
      } catch (error) {
        errors.push(error.message)
      }
    }
    // if none of the services returned successfully, throw error
    if (!success) throw new Error(errors)
    return confirmed
  }

  this.btcConfirmBlockHeaderAsync = async (blockHeightOrHash, expectedValue) => {
    let confirmed = false
    let errors = []
    let success = false
    for (let index in SERVICES_TO_USE) {
      try {
        confirmed = await _confirmBTCBlockHeaderAsync(SERVICES_TO_USE[index], blockHeightOrHash, expectedValue)
        success = true
        break
      } catch (error) {
        errors.push(error.message)
      }
    }
    // if none of the services returned successfully, throw error
    if (!success) throw new Error(errors)
    return confirmed
  }

  this.btcGetTxStatsAsync = async (transactionId) => {
    let txStats
    let errors = []
    let success = false
    for (let index in SERVICES_TO_USE) {
      try {
        txStats = await _getBTCTransactionStatsAsync(SERVICES_TO_USE[index], transactionId)
        success = true
        break
      } catch (error) {
        errors.push(error.message)
      }
    }
    // if none of the services returned successfully, throw error
    if (!success) throw new Error(errors)
    return txStats
  }

  this.btcGetTxConfirmationCountAsync = async (transactionId) => {
    let count = 0
    let errors = []
    let success = false
    for (let index in SERVICES_TO_USE) {
      try {
        count = await _getBTCTransactionConfirmationCountAsync(SERVICES_TO_USE[index], transactionId)
        success = true
        break
      } catch (error) {
        errors.push(error.message)
      }
    }
    // if none of the services returned successfully, throw error
    if (!success) throw new Error(errors)
    return count
  }

  this.btcGetBlockStatsAsync = async (blockHeightOrHash) => {
    let blockStats
    let errors = []
    let success = false
    for (let index in SERVICES_TO_USE) {
      try {
        blockStats = await _getBTCBlockStatsAsync(SERVICES_TO_USE[index], blockHeightOrHash)
        success = true
        break
      } catch (error) {
        errors.push(error.message)
      }
    }
    // if none of the services returned successfully, throw error
    if (!success) throw new Error(errors)
    return blockStats
  }

  this.btcGetBlockTxIdsAsync = async (blockHeightOrHash) => {
    let ids = null
    let errors = []
    let success = false
    for (let index in SERVICES_TO_USE) {
      try {
        ids = await _getBTCBlockTxIdsAsync(SERVICES_TO_USE[index], blockHeightOrHash)
        success = true
        break
      } catch (error) {
        errors.push(error.message)
      }
    }
    // if none of the services returned successfully, throw error
    if (!success) throw new Error(errors)
    return ids
  }

  this.btcGetEstimatedFeeRateSatPerByteAsync = async () => {
    let feeRateSatPerByte = null
    let errors = []
    let success = false
    for (let index in SERVICES_TO_USE) {
      try {
        feeRateSatPerByte = await _getEstimatedFeeRateSatPerByteAsync(SERVICES_TO_USE[index])
        success = true
        break
      } catch (error) {
        errors.push(error.message)
      }
    }
    // if none of the services returned successfully, throw error
    if (!success) throw new Error(errors)
    return feeRateSatPerByte
  }

  // ETH functions

  this.ethConfirmDataAsync = async (transactionId, expectedValue) => {
    let confirmed = false
    let errors = []
    let success = false
    for (let index in SERVICES_TO_USE) {
      try {
        confirmed = await _confirmEthDataAsync(SERVICES_TO_USE[index], transactionId, expectedValue)
        success = true
        break
      } catch (error) {
        errors.push(error.message)
      }
    }
    // if none of the services returned successfully, throw error
    if (!success) throw new Error(errors)
    return confirmed
  }

  /// ///////////////////////////////////////
  //  Private Utility functions
  /// ///////////////////////////////////////

  async function _embedAsync (serviceName, hexData, address, keyPair, feeTotalSat) {
    // get an instance of the selected service
    let blockchainService = utils.getBlockchainService(serviceName)

    let serviceOptions = {}
    serviceOptions.btcUseTestnet = btcUseTestnet
    if (serviceName === 'custom-insightapi') serviceOptions.insightApiBase = customInsightApiBase
    if (serviceName === 'insightapi') serviceOptions.insightApiBase = defaultInsightApiBase
    if (serviceName === 'blockcypher') serviceOptions.blockcypherToken = blockcypherToken

    let unspentOutputs = await blockchainService.getUnspentOutputsAsync(address, serviceOptions)
    let spendableOutput = _.orderBy(unspentOutputs, 'amountSatoshi', 'desc')[0]

    if (!spendableOutput) throw new Error('No unspent outputs available, balance likely 0')
    if (spendableOutput.amountSatoshi < feeTotalSat) throw new Error('No outputs with sufficient funds available')

    let tx = new bitcoin.TransactionBuilder(btcNetwork)
    tx.addInput(spendableOutput.fromTxHash, spendableOutput.outputIndex)

    let buffer = Buffer.from(hexData, 'hex')
    var dataScript = bitcoin.script.nullData.output.encode(buffer)
    tx.addOutput(dataScript, 0)

    let spendableAmountSatoshi = spendableOutput.amountSatoshi
    let returnAmountSatoshi = spendableAmountSatoshi - feeTotalSat
    tx.addOutput(address, returnAmountSatoshi)

    tx.sign(0, keyPair)

    let transactionHex = tx.build().toHex()

    let txResults = {}
    txResults.txId = await blockchainService.pushTransactionAsync(transactionHex, serviceOptions)
    txResults.rawTx = transactionHex

    return txResults
  }

  async function _pushSplitOutputsTxAsync (serviceName, maxOutputs, address, keyPair, feeTotalSat) {
    // get an instacnce of the selected service
    let blockchainService = utils.getBlockchainService(serviceName)

    let serviceOptions = {}
    serviceOptions.btcUseTestnet = btcUseTestnet
    if (serviceName === 'custom-insightapi') serviceOptions.insightApiBase = customInsightApiBase
    if (serviceName === 'insightapi') serviceOptions.insightApiBase = defaultInsightApiBase
    if (serviceName === 'blockcypher') serviceOptions.blockcypherToken = blockcypherToken

    let unspentOutputs = await blockchainService.getUnspentOutputsAsync(address, serviceOptions)

    let newOutputCount = maxOutputs
    let totalBalanceSatoshi = _.sumBy(unspentOutputs, (x) => { return x.amountSatoshi }) // value of all unspent outputs
    let workingBalanceSatoshi = totalBalanceSatoshi - feeTotalSat // deduct the fee, the remainder is to be divided amongst the outputs
    let perOutputAmountSatoshi = _.floor(workingBalanceSatoshi / newOutputCount) // amount for each output
    // ensure the we dont split the outputs too much, leaving the per output balance too low, reduce output count if needed
    while (perOutputAmountSatoshi < 10000) {
      if (--newOutputCount < 1) throw new Error('Not enough funds to complete transaction')
      perOutputAmountSatoshi = workingBalanceSatoshi / newOutputCount
    }

    let tx = new bitcoin.TransactionBuilder(btcNetwork)

    _(unspentOutputs).forEach((spendableOutput) => {
      tx.addInput(spendableOutput.fromTxHash, spendableOutput.outputIndex)
    })

    for (let x = 0; x < newOutputCount; x++) {
      tx.addOutput(address, perOutputAmountSatoshi)
    }

    for (let x = 0; x < tx.inputs.length; x++) {
      tx.sign(x, keyPair)
    }

    let transactionHex = tx.build().toHex()

    let splitResult = {}
    splitResult.txId = await blockchainService.pushTransactionAsync(transactionHex, serviceOptions)
    splitResult.count = newOutputCount

    return splitResult
  }

  async function _confirmOpReturnAsync (serviceName, transactionId, expectedValue) {
    // get an instance of the selected service
    let blockchainService = utils.getBlockchainService(serviceName)

    let serviceOptions = {}
    serviceOptions.btcUseTestnet = btcUseTestnet
    if (serviceName === 'custom-insightapi') serviceOptions.insightApiBase = customInsightApiBase
    if (serviceName === 'insightapi') serviceOptions.insightApiBase = defaultInsightApiBase
    if (serviceName === 'blockcypher') serviceOptions.blockcypherToken = blockcypherToken

    let result = await blockchainService.confirmOpReturnAsync(transactionId, expectedValue, serviceOptions)
    return result
  }

  async function _confirmBTCBlockHeaderAsync (serviceName, blockHeightOrHash, expectedValue) {
    // get an instance of the selected service
    let blockchainService = utils.getBlockchainService(serviceName)

    let serviceOptions = {}
    serviceOptions.btcUseTestnet = btcUseTestnet
    if (serviceName === 'custom-insightapi') serviceOptions.insightApiBase = customInsightApiBase
    if (serviceName === 'insightapi') serviceOptions.insightApiBase = defaultInsightApiBase
    if (serviceName === 'blockcypher') serviceOptions.blockcypherToken = blockcypherToken

    let result = await blockchainService.confirmBTCBlockHeaderAsync(blockHeightOrHash, expectedValue, serviceOptions)
    return result
  }

  async function _getBTCTransactionStatsAsync (serviceName, transactionId) {
    // get an instance of the selected service
    let blockchainService = utils.getBlockchainService(serviceName)

    let serviceOptions = {}
    serviceOptions.btcUseTestnet = btcUseTestnet
    if (serviceName === 'custom-insightapi') serviceOptions.insightApiBase = customInsightApiBase
    if (serviceName === 'insightapi') serviceOptions.insightApiBase = defaultInsightApiBase
    if (serviceName === 'blockcypher') serviceOptions.blockcypherToken = blockcypherToken

    let result = await blockchainService.getBTCTransactionStatsAsync(transactionId, serviceOptions)
    return result
  }

  async function _getBTCBlockStatsAsync (serviceName, blockHeightOrHash) {
    // get an instance of the selected service
    let blockchainService = utils.getBlockchainService(serviceName)

    let serviceOptions = {}
    serviceOptions.btcUseTestnet = btcUseTestnet
    if (serviceName === 'custom-insightapi') serviceOptions.insightApiBase = customInsightApiBase
    if (serviceName === 'insightapi') serviceOptions.insightApiBase = defaultInsightApiBase
    if (serviceName === 'blockcypher') serviceOptions.blockcypherToken = blockcypherToken

    let result = await blockchainService.getBTCBlockStatsAsync(blockHeightOrHash, serviceOptions)
    return result
  }

  async function _getBTCTransactionConfirmationCountAsync (serviceName, transactionId) {
    // get an instance of the selected service
    let blockchainService = utils.getBlockchainService(serviceName)

    let serviceOptions = {}
    serviceOptions.btcUseTestnet = btcUseTestnet
    if (serviceName === 'custom-insightapi') serviceOptions.insightApiBase = customInsightApiBase
    if (serviceName === 'insightapi') serviceOptions.insightApiBase = defaultInsightApiBase
    if (serviceName === 'blockcypher') serviceOptions.blockcypherToken = blockcypherToken

    let result = await blockchainService.getBTCTransactionConfirmationCountAsync(transactionId, serviceOptions)
    return result
  }

  async function _getBTCBlockTxIdsAsync (serviceName, blockHeightOrHash) {
    // get an instance of the selected service
    let blockchainService = utils.getBlockchainService(serviceName)

    let serviceOptions = {}
    serviceOptions.btcUseTestnet = btcUseTestnet
    if (serviceName === 'custom-insightapi') serviceOptions.insightApiBase = customInsightApiBase
    if (serviceName === 'insightapi') serviceOptions.insightApiBase = defaultInsightApiBase
    if (serviceName === 'blockcypher') serviceOptions.blockcypherToken = blockcypherToken

    let result = await blockchainService.getBTCBlockTxIdsAsync(blockHeightOrHash, serviceOptions)
    return result
  }

  async function _getEstimatedFeeRateSatPerByteAsync (serviceName) {
    // get an instance of the selected service
    let blockchainService = utils.getBlockchainService(serviceName)

    let serviceOptions = {}
    serviceOptions.btcUseTestnet = btcUseTestnet
    if (serviceName === 'custom-insightapi') serviceOptions.insightApiBase = customInsightApiBase
    if (serviceName === 'insightapi') serviceOptions.insightApiBase = defaultInsightApiBase
    if (serviceName === 'blockcypher') serviceOptions.blockcypherToken = blockcypherToken

    let result = await blockchainService.getEstimatedFeeRateSatPerByteAsync(serviceOptions)
    return result
  }

  async function _confirmEthDataAsync (serviceName, transactionId, expectedValue) {
    // get an instance of the selected service
    let blockchainService = utils.getBlockchainService(serviceName)

    let serviceOptions = {}
    serviceOptions.btcUseTestnet = btcUseTestnet
    if (serviceName === 'custom-insightapi') serviceOptions.insightApiBase = customInsightApiBase
    if (serviceName === 'insightapi') serviceOptions.insightApiBase = defaultInsightApiBase
    if (serviceName === 'blockcypher') serviceOptions.blockcypherToken = blockcypherToken

    let result = await blockchainService.confirmEthDataAsync(transactionId, expectedValue, serviceOptions)
    return result
  }
}

module.exports = BlockchainAnchor
module.exports.getInstance = (anchorOptions) => {
  return new BlockchainAnchor(anchorOptions)
}
