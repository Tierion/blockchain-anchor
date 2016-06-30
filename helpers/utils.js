/*jslint node: true */
'use strict';

var blockcypherSvc = require('../services/blockcypher.js');
var blockrSvc = require('../services/blockr.js');
var insightbitpaySvc = require('../services/insightbitpay.js');

module.exports = {
    getBlockchainService: function (blockchainServiceName) { 
        var service;
    
        // return the selected service, default to BlockCypher if service not found
        switch (blockchainServiceName.toLowerCase()) {
            case 'blockcypher':
                service = blockcypherSvc;
                break;
            case 'blockr':
                service = blockrSvc;
                break;
            case 'insightbitpay':
                service = insightbitpaySvc;
                break;
            default:
                service = blockcypherSvc;
        }
        return service;
    }
};