var bitcoin = require('bitcoinjs-lib');
var _ = require('lodash');
var utils = require('./helpers/utils.js');

var SERVICES = ['BlockCypher', 'Blockr', 'InsightBitpay'];

function BlockchainAnchor(privateKeyWIF, useTestnet, blockchainServiceName, fee) {
    var that = this;
    
    // when useTestnet set to true, TestNet is used, otherwise defaults to Mainnet
    that.network = useTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
    
    // get keyPair for the supplied privateKeyWIF
    that.keyPair = bitcoin.ECPair.fromWIF(privateKeyWIF, that.network);
    
    // derive target address from the keyPair
    that.address = that.keyPair.getAddress();
    
    // check for valid blockchainServiceName, if not, set to Any    
    that.blockchainServiceName = SERVICES.indexOf(blockchainServiceName || '') > -1 ? blockchainServiceName : 'Any';
    
    // check for fee, default to .0001 if not defined
    that.fee = fee || 0.0001;
    
    ////////////////////////////////////////////
    // PRIVATE functions
    ////////////////////////////////////////////

    function pushEmbedTx(blockchainServiceName, address, data) {
        // get an instacne of the selected service
        var blockchainService = utils.getBlockchainService(blockchainServiceName);
    
        // get an array of the unspent outputs
        var unspentResult = blockchainService.getUnspentOutputs(address);
        if (unspentResult.hasError) return { hasError: true, message: unspentResult.message };

        return { hasError: false, message: 'success', txId: '123456789' };
    }
    
    function pushSplitOutputsTx(blockchainServiceName, address, maxOutputs) {
        // get an instacne of the selected service
        var blockchainService = utils.getBlockchainService(blockchainServiceName);
    
        // get an array of the unspent outputs
        var unspentResult = blockchainService.getUnspentOutputs(address);
        if (unspentResult.hasError) return { hasError: true, message: unspentResult.message };

        return { hasError: false, message: 'success', txId: '123456789' };
    }

    function confirmOpReturn(blockchainServiceName, transactionId, expectedValue) {
        // get an instacne of the selected service
        var blockchainService = utils.getBlockchainService(blockchainServiceName);
        return blockchainService.confirmOpReturn(transactionId, expectedValue);
    }
    
    ////////////////////////////////////////////
    // PUBLIC functions
    ////////////////////////////////////////////

    this.embed = function(hexData) {
        var result;
        if (that.blockchainServiceName != 'Any') // a specific service was chosen, attempt once with that service
        {
            result = pushEmbedTx(that.blockchainServiceName, that.address, hexData);
            if (result.hasError) { // error pushing transaction onto the network, throw exception
                throw result.message;
            } else { // success pushing transaction onto network, return the transactionId
                return result.txId;
            }
        } else { // use the first service option, continue with the next option upon failure until all have been attempted
            var errors = [];
            var txId = 0;

            _(SERVICES).each(function (blockchainServiceName) {
                result = pushEmbedTx(blockchainServiceName, that.address, hexData);
                if (result.hasError) { // error pushing transaction onto the network, add exception to error array
                    errors.push(result.message);
                } else { // success pushing transaction onto network, set the transactionId and return false to break foreach
                    txId = result.txId;
                    return false;
                }
            });

            if (txId == 0) { // none of the services returned successfully, throw exception
                throw errors.join('\n');
            } else { // a service has succeeded and returned a new transactionId, return that id to caller
                return txId;
            }
        }
    }

    this.splitOutputs = function(maxOutputs) {
        var result;
        if (that.blockchainServiceName != 'Any') // a specific service was chosen, attempt once with that service
        {
            result = pushSplitOutputsTx(that.blockchainServiceName, that.address, maxOutputs);
            if (result.hasError) { // error pushing transaction onto the network, throw exception
                throw result.message;
            } else { // success pushing transaction onto network, return the transactionId
                return result.txId;
            }
        } else { // use the first service option, continue with the next option upon failure until all have been attempted
            var errors = [];
            var txId = 0;

            _(SERVICES).each(function (blockchainServiceName) {
                result = pushSplitOutputsTx(blockchainServiceName, that.address, maxOutputs);
                if (result.hasError) { // error pushing transaction onto the network, add exception to error array
                    errors.push(result.message);
                } else { // success pushing transaction onto network, set the transactionId and return false to break foreach
                    txId = result.txId;
                    return false;
                }
            });

            if (txId == 0) { // none of the services returned successfully, throw exception
                throw errors.join('\n');
            } else { // a service has succeeded and returned a new transactionId, return that id to caller
                return txId;
            }
        }
    }

    this.confirm = function(transactionId, expectedValue) { 
        var result;
        if (that.blockchainServiceName != 'Any') // a specific service was chosen, attempt once with that service
        {
            result = confirmOpReturn(that.blockchainServiceName, transactionId, expectedValue);
            if (result.hasError) { // error pushing transaction onto the network, throw exception
                throw result.message;
            } else { // success pushing transaction onto network, return the transactionId
                return result.message;
            }
        } else { // use the first service option, continue with the next option upon failure until all have been attempted
            var errors = [];
            var isConfirmed = null;

            _(SERVICES).each(function (blockchainServiceName) {  
                result = confirmOpReturn(blockchainServiceName, transactionId, expectedValue);
                console.log(result);
                if (result.hasError) { // error confirming transaction onto the network, add exception to error array
                    errors.push(result.message);
                } else { // success confirming transaction onto network, set the transactionId and return false to break foreach
                    isConfirmed = result.message;
                    return false;
                }
            });

            if (isConfirmed == null) { // none of the services returned successfully, throw exception
                throw errors.join('\n');
            } else { // a service has succeeded and returned a new transactionId, return that id to caller
                return isConfirmed;
            }
        }
    }
}

module.exports = function(privateKeyWIF, useTestnet, blockchainServiceName, fee) {
    return new BlockchainAnchor(privateKeyWIF, useTestnet, blockchainServiceName, fee);    
};