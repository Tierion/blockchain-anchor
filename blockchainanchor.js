const bitcoin = require('bitcoinjs-lib')
const _ = require('lodash')
const utils = require('./lib/utils.js')

let SERVICES = ['insightapi', 'blockcypher']

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
  let service = 'any'
  // check for supplied service name, if not valid, throw error
  if (anchorOptions && anchorOptions.service !== undefined) {
    let serviceLowercase = anchorOptions.service.toLowerCase()
    if (SERVICES.indexOf(serviceLowercase) > -1) {
      service = serviceLowercase
    } else {
      throw new Error(`Unknown service : ${anchorOptions.service}`)
    }
  }

  let insightApiBase = `https://${(btcUseTestnet ? 'test-' : '')}insight.bitpay.com/api`
  // if insightApiBase is supplied, override default bitpay instance
  // be sure that the btcUseTestnet setting matches the configuration of the custom insight-api instance...
  // if the instance at insightApiBase is testnet, you must set btcUseTestnet to true, otherwise methods will fail
  if (anchorOptions && anchorOptions.insightApiBase !== undefined) {
    insightApiBase = anchorOptions.insightApiBase
  }

  let blockcypherToken = null
  // check for blockcypherToken
  if (anchorOptions && anchorOptions.blockcypherToken !== undefined) {
    blockcypherToken = anchorOptions.blockcypherToken
  } else {
    // blockcypher token was not supplied, so remove from available services
    _.remove(SERVICES, (x) => {
      return x === 'blockcypher'
    })
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
    if (service !== 'any') {
      // a specific service was chosen, attempt once with that service
      if (service === 'blockcypher' && !blockcypherToken) throw new Error('Requested blockcypher service, but no blockcypherToken supplied')
      txResults = await _embedAsync(service, hexData, address, keyPair, feeTotalSat)
    } else { // use the first service option, continue with the next option upon failure until all have been attempted
      let errors = []
      let success = false
      for (let index in SERVICES) {
        try {
          txResults = await _embedAsync(SERVICES[index], hexData, address, keyPair, feeTotalSat)
          success = true
          break
        } catch (error) {
          errors.push(error.message)
        }
      }
      // if none of the services returned successfully, throw error
      if (!success) throw new Error(errors)
    }
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
    if (service !== 'any') {
      // a specific service was chosen, attempt once with that service
      if (service === 'blockcypher' && !blockcypherToken) throw new Error('Requested blockcypher service, but no blockcypherToken supplied')
      txResults = await _pushSplitOutputsTxAsync(service, maxOutputs, address, keyPair, feeTotalSat)
    } else { // use the first service option, continue with the next option upon failure until all have been attempted
      let errors = []
      let success = false
      for (let index in SERVICES) {
        try {
          txResults = await _pushSplitOutputsTxAsync(SERVICES[index], maxOutputs, address, keyPair, feeTotalSat)
          success = true
          break
        } catch (error) {
          errors.push(error.message)
        }
      }
      // if none of the services returned successfully, throw error
      if (!success) throw new Error(errors)
    }
    return txResults
  }

  this.btcConfirmOpReturnAsync = async (transactionId, expectedValue) => {
    let confirmed = false
    if (service !== 'any') {
      // a specific service was chosen, attempt once with that service
      confirmed = await _confirmOpReturnAsync(service, transactionId, expectedValue)
    } else { // use the first service option, continue with the next option upon failure until all have been attempted
      let errors = []
      let success = false
      for (let index in SERVICES) {
        try {
          confirmed = await _confirmOpReturnAsync(SERVICES[index], transactionId, expectedValue)
          success = true
          break
        } catch (error) {
          errors.push(error.message)
        }
      }
      // if none of the services returned successfully, throw error
      if (!success) throw new Error(errors)
    }
    return confirmed
  }

  this.btcConfirmBlockHeaderAsync = async (blockHeight, expectedValue) => {
    let confirmed = false
    if (service !== 'any') {
      // a specific service was chosen, attempt once with that service
      confirmed = await _confirmBTCBlockHeaderAsync(service, blockHeight, expectedValue)
    } else { // use the first service option, continue with the next option upon failure until all have been attempted
      let errors = []
      let success = false
      for (let index in SERVICES) {
        try {
          confirmed = await _confirmBTCBlockHeaderAsync(SERVICES[index], blockHeight, expectedValue)
          success = true
          break
        } catch (error) {
          errors.push(error.message)
        }
      }
      // if none of the services returned successfully, throw error
      if (!success) throw new Error(errors)
    }
    return confirmed
  }

  this.btcGetTxStatsAsync = async (transactionId) => {
    let txStats
    if (service !== 'any') {
      // a specific service was chosen, attempt once with that service
      txStats = await _getBTCTransactionStatsAsync(service, transactionId)
    } else { // use the first service option, continue with the next option upon failure until all have been attempted
      let errors = []
      let success = false
      for (let index in SERVICES) {
        try {
          txStats = await _getBTCTransactionStatsAsync(SERVICES[index], transactionId)
          success = true
          break
        } catch (error) {
          errors.push(error.message)
        }
      }
      // if none of the services returned successfully, throw error
      if (!success) throw new Error(errors)
    }
    return txStats
  }

  this.btcGetTxConfirmationCountAsync = async (transactionId) => {
    let count = 0
    if (service !== 'any') {
      // a specific service was chosen, attempt once with that service
      count = await _getBTCTransactionConfirmationCountAsync(service, transactionId)
    } else { // use the first service option, continue with the next option upon failure until all have been attempted
      let errors = []
      let success = false
      for (let index in SERVICES) {
        try {
          count = await _getBTCTransactionConfirmationCountAsync(SERVICES[index], transactionId)
          success = true
          break
        } catch (error) {
          errors.push(error.message)
        }
      }
      // if none of the services returned successfully, throw error
      if (!success) throw new Error(errors)
    }
    return count
  }

  this.btcGetBlockTxIdsAsync = async (blockHeight) => {
    let ids = null
    if (service !== 'any') {
      // a specific service was chosen, attempt once with that service
      ids = await _getBTCBlockTxIdsAsync(service, blockHeight)
    } else { // use the first service option, continue with the next option upon failure until all have been attempted
      let errors = []
      let success = false
      for (let index in SERVICES) {
        try {
          ids = await _getBTCBlockTxIdsAsync(SERVICES[index], blockHeight)
          success = true
          break
        } catch (error) {
          errors.push(error.message)
        }
      }
      // if none of the services returned successfully, throw error
      if (!success) throw new Error(errors)
    }
    return ids
  }

  // ETH functions

  this.ethConfirmDataAsync = async (transactionId, expectedValue) => {
    let confirmed = false
    if (service !== 'any') {
      // a specific service was chosen, attempt once with that service
      confirmed = await _confirmEthDataAsync(service, transactionId, expectedValue)
    } else { // use the first service option, continue with the next option upon failure until all have been attempted
      let errors = []
      let success = false
      for (let index in SERVICES) {
        try {
          confirmed = await _confirmEthDataAsync(SERVICES[index], transactionId, expectedValue)
          success = true
          break
        } catch (error) {
          errors.push(error.message)
        }
      }
      // if none of the services returned successfully, throw error
      if (!success) throw new Error(errors)
    }
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
    if (serviceName === 'insightapi') serviceOptions.insightApiBase = insightApiBase
    if (serviceName === 'blockcypher' && blockcypherToken) serviceOptions.blockcypherToken = blockcypherToken

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
    if (serviceName === 'insightapi') serviceOptions.insightApiBase = insightApiBase
    if (serviceName === 'blockcypher' && blockcypherToken) serviceOptions.blockcypherToken = blockcypherToken

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
    if (serviceName === 'insightapi') serviceOptions.insightApiBase = insightApiBase
    if (serviceName === 'blockcypher' && blockcypherToken) serviceOptions.blockcypherToken = blockcypherToken

    let result = await blockchainService.confirmOpReturnAsync(transactionId, expectedValue, serviceOptions)
    return result
  }

  async function _confirmEthDataAsync (serviceName, transactionId, expectedValue) {
    // get an instance of the selected service
    let blockchainService = utils.getBlockchainService(serviceName)

    let serviceOptions = {}
    serviceOptions.btcUseTestnet = btcUseTestnet
    if (serviceName === 'insightapi') serviceOptions.insightApiBase = insightApiBase
    if (serviceName === 'blockcypher' && blockcypherToken) serviceOptions.blockcypherToken = blockcypherToken

    let result = await blockchainService.confirmEthDataAsync(transactionId, expectedValue, serviceOptions)
    return result
  }

  async function _confirmBTCBlockHeaderAsync (serviceName, blockHeight, expectedValue) {
    // get an instance of the selected service
    let blockchainService = utils.getBlockchainService(serviceName)

    let serviceOptions = {}
    serviceOptions.btcUseTestnet = btcUseTestnet
    if (serviceName === 'insightapi') serviceOptions.insightApiBase = insightApiBase
    if (serviceName === 'blockcypher' && blockcypherToken) serviceOptions.blockcypherToken = blockcypherToken

    let result = await blockchainService.confirmBTCBlockHeaderAsync(blockHeight, expectedValue, serviceOptions)
    return result
  }

  async function _getBTCTransactionStatsAsync (serviceName, transactionId) {
    // get an instance of the selected service
    let blockchainService = utils.getBlockchainService(serviceName)

    let serviceOptions = {}
    serviceOptions.btcUseTestnet = btcUseTestnet
    if (serviceName === 'insightapi') serviceOptions.insightApiBase = insightApiBase
    if (serviceName === 'blockcypher' && blockcypherToken) serviceOptions.blockcypherToken = blockcypherToken

    let result = await blockchainService.getBTCTransactionStatsAsync(transactionId, serviceOptions)
    return result
  }

  async function _getBTCTransactionConfirmationCountAsync (serviceName, transactionId) {
    // get an instance of the selected service
    let blockchainService = utils.getBlockchainService(serviceName)

    let serviceOptions = {}
    serviceOptions.btcUseTestnet = btcUseTestnet
    if (serviceName === 'insightapi') serviceOptions.insightApiBase = insightApiBase
    if (serviceName === 'blockcypher' && blockcypherToken) serviceOptions.blockcypherToken = blockcypherToken

    let result = await blockchainService.getBTCTransactionConfirmationCountAsync(transactionId, serviceOptions)
    return result
  }

  async function _getBTCBlockTxIdsAsync (serviceName, blockHeight) {
    // get an instance of the selected service
    let blockchainService = utils.getBlockchainService(serviceName)

    let serviceOptions = {}
    serviceOptions.btcUseTestnet = btcUseTestnet
    if (serviceName === 'insightapi') serviceOptions.insightApiBase = insightApiBase
    if (serviceName === 'blockcypher' && blockcypherToken) serviceOptions.blockcypherToken = blockcypherToken

    let result = await blockchainService.getBTCBlockTxIdsAsync(blockHeight, serviceOptions)
    return result
  }
}

module.exports = BlockchainAnchor
module.exports.getInstance = (anchorOptions) => {
  return new BlockchainAnchor(anchorOptions)
}
