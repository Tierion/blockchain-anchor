const blockcypherSvc = require('./services/blockcypher.js')
const insightapiSvc = require('./services/insightapi.js')

module.exports = {
  // return the selected service, default to insightapi if service not found
  getBlockchainService: (blockchainServiceName) => {
    let service

    switch (blockchainServiceName.toLowerCase()) {
      case 'insightapi':
        service = insightapiSvc
        break
      case 'blockcypher':
        service = blockcypherSvc
        break
      default:
        service = insightapiSvc
    }
    return service
  }
}
