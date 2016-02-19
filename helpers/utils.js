var blockcypherSvc = require('../services/blockcypher.js');
var blockrSvc = require('../services/blockr.js');
var insightbitpaySvc = require('../services/insightbitpay.js');

module.exports = {
    getBlockchainService: function (blockchainServiceName) { 
        var service;
    
        // return the selected service, default to BlockCypher if service not found
        switch (blockchainServiceName) {
            case 'BlockCypher':
                service = blockcypherSvc;
                break;
            case 'Blockr':
                service = blockrSvc;
                break;
            case 'InsightBitpay':
                service = insightbitpaySvc;
                break;
            default:
                service = blockcypherSvc;
        }
        return service;
    }
};