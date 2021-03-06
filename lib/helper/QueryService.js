/*
 * SPDX-License-Identifier: GNU GENERAL PUBLIC LICENSE 2.0
 */

'use strict';

// Import lib
const util = require('util');

const logger = require('../utils/logger').getLogger('query-service')
const common = require('../utils/common')

/**
 * QueryService class provide 'queryChaincode' function to request a queried-transaction.
 * It also integrates with 'prom-client' to measure duration when requesting.
 */
class QueryService {
    constructor() { }

    /**
     * queryChaincode sends a proposal to one or more endorsing peers that will be handled by the chaincode
     * @param {string} peerNames 
     * @param {string} channelName 
     * @param {string} chaincodeName is chaincodeID
     * @param {string} fcn is a function's name of chaincode
     * @param {string} args 
     * @param {string} orgName 
     * @param {string} userName 
     */
    async queryChaincode(peerNames, channelName, chaincodeName, fcn, args, orgName, userName) {
        try {
            const client = await common.getClientForOrg(orgName, userName)
            // first setup the client for this or
            const channel = await common.getChannel(orgName, userName, channelName);
            if (!channel) {
                let message = util.format('Channel %s was not defined in the connection profile', channelName);
                logger.error(message);
                return common.createReturn(202, "", message, message);
            }
            const tx_id = client.newTransactionID();

            let request = {
                targets: peerNames, //queryByChaincode allows for multiple targets
                chaincodeId: chaincodeName,
                fcn: fcn,
                args: args,
                chainId: channelName,
                txId: tx_id
            };

            const proposalResults = await channel.sendTransactionProposal(request);
            const responses = proposalResults[0];
            logger.debug('queryByChaincode - results received');

            if (!responses || !Array.isArray(responses)) {
                return common.createReturn(202, "", `Payload results are missing from the chaincode query`, "");
            }

            if (responses[0]) {
                if (responses[0] instanceof Error) {
                    let err = responses[0];
                    let jsonErr = JSON.stringify(err, Object.getOwnPropertyNames(err));
                    let objErr = JSON.parse(jsonErr);
                    try {
                        let convertObj = JSON.parse(objErr.message);
                        // logger.debug('convertObj: ', convertObj);
                        return common.createReturn(convertObj.status, "", convertObj.msg, convertObj.msg);
                    } catch (err) {
                        logger.error('error: ', err);
                        return common.createReturn(convertObj.status, "", err, err);
                    }
                } else if (responses[0].response && responses[0].response.payload) {
                    logger.debug("RESPONSE DATA: ", responses[0].response)
                    var obj = responses[0].response
                    try {
                        obj.payload = JSON.parse(obj.payload.toString('utf8'));
                    } catch (e) {
                        obj.payload = obj.payload.toString('utf8');
                    }
                    return common.createReturn(obj.status, obj.payload, "Success", "Success");
                } else {
                    logger.error('queryByChaincode - unknown or missing results in query ::' + responses);
                    return common.createReturn(202, "", `queryByChaincode - unknown or missing results in query`, "");
                }

            } else {
                logger.error('response_payloads is null');
                return common.createReturn(202, "", `response_payloads is null`, "");
            }
        } catch (error) {
            logger.error('Failed to query due to error: ' + error.stack ? error.stack : error);
            return common.createReturn(202, "", error.toString(), error.toString());
        }
    }

    /**
     * getBlockByNumber Get block's information by blockNumber
     * @param {string} peerName 
     * @param {string} channelName 
     * @param {string} blockNumber 
     * @param {string} orgName 
     * @param {string} userName 
     */
    async getBlockByNumber(peerName, channelName, blockNumber, orgName, userName) {
        try {
            let channel = await common.getChannel(orgName, userName, channelName);
            if (!channel) {
                let message = util.format('Channel %s was not defined in the connection profile', channelName);
                logger.error(message);
                throw new Error(message);
            }

            let response_payload = await channel.queryBlock(parseInt(blockNumber, peerName));
            if (response_payload) {
                logger.debug(response_payload);
                return response_payload;
            } else {
                logger.error('response_payload is null');
                return 'response_payload is null';
            }
        } catch (error) {
            logger.error('Failed to query due to error: ' + error.stack ? error.stack : error);
            return error.toString();
        }
    }

    /**
     * Get transaction's information by trxnID (transaction ID)
     * @param {string} peerName 
     * @param {string} channelName 
     * @param {string} trxnID 
     * @param {string} orgName 
     * @param {string} userName 
     */
    async getTransactionByID(peerName, channelName, trxnID, orgName, userName) {
        try {
            let channel = await common.getChannel(orgName, userName, channelName);
            if (!channel) {
                let message = util.format('Channel %s was not defined in the connection profile', channelName);
                logger.error(message);
                throw new Error(message);
            }

            let response_payload = await channel.queryTransaction(trxnID, peerName);
            if (response_payload) {
                logger.debug(response_payload);
                return response_payload;
            } else {
                logger.error('response_payload is null');
                return 'response_payload is null';
            }
        } catch (error) {
            logger.error('Failed to query due to error: ' + error.stack ? error.stack : error);
            return error.toString();
        }
    }

    /**
     * Get block's information by blockHash
     * @param {string} peerName 
     * @param {string} channelName 
     * @param {string} hash 
     * @param {string} orgName 
     * @param {string} userName 
     */
    async getBlockByHash(peerName, channelName, hash, orgName, userName) {
        try {
            var channel = await common.getChannel(orgName, userName, channelName);
            if (!channel) {
                let message = util.format('Channel %s was not defined in the connection profile', channelName);
                logger.error(message);
                throw new Error(message);
            }

            let response_payload = await channel.queryBlockByHash(Buffer.from(hash, 'hex'), peerName);
            if (response_payload) {
                logger.debug(response_payload);
                return response_payload;
            } else {
                logger.error('response_payload is null');
                return 'response_payload is null';
            }
        } catch (error) {
            logger.error('Failed to query due to error: ' + error.stack ? error.stack : error);
            return error.toString();
        }
    };

    /**
     * Queries for various useful information on the state of the Channel (height, known peers)
     * @param {string} peerName 
     * @param {string} channelName 
     * @param {string} orgName 
     * @param {string} userName 
     */
    async getChannelInfo(peerName, channelName, orgName, userName) {
        try {
            let channel = await common.getChannel(orgName, userName, channelName);
            if (!channel) {
                let message = util.format('Channel %s was not defined in the connection profile', channelName);
                logger.error(message);
                throw new Error(message);
            }

            let response_payload = await channel.queryInfo(peerName);
            if (response_payload) {
                logger.debug(response_payload);
                return response_payload;
            } else {
                logger.error('response_payload is null');
                return 'response_payload is null';
            }
        } catch (error) {
            logger.error('Failed to query due to error: ' + error.stack ? error.stack : error);
            return error.toString();
        }
    }

    /**
     * Queries the installed chaincodes on a peer.
     * @param {string} peerName 
     * @param {string} channelName 
     * @param {string} type 
     * @param {string} orgName 
     */
    async getInstalledChaincodes(peerName, channelName, type, orgName) {
        try {
            // First setup the client for this org
            var client = await common.getClientForOrg(orgName, userName);
            logger.debug('Successfully got the fabric client for the organization "%s"', orgName);

            let response = null
            if (type === 'installed') {
                response = await client.queryInstalledChaincodes(peerName, true); //use the admin identity
            } else {
                var channel = await common.getChannel(orgName, userName, channelName);
                if (!channel) {
                    let message = util.format('Channel %s was not defined in the connection profile', channelName);
                    logger.error(message);
                    throw new Error(message);
                }
                response = await channel.queryInstantiatedChaincodes(peerName, true); //use the admin identity
            }
            if (response) {
                if (type === 'installed') {
                    logger.debug('<<< Installed Chaincodes >>>');
                } else {
                    logger.debug('<<< Instantiated Chaincodes >>>');
                }
                var details = [];
                for (let i = 0; i < response.chaincodes.length; i++) {
                    logger.debug('name: ' + response.chaincodes[i].name + ', version: ' +
                        response.chaincodes[i].version + ', path: ' + response.chaincodes[i].path
                    );
                    details.push('name: ' + response.chaincodes[i].name + ', version: ' +
                        response.chaincodes[i].version + ', path: ' + response.chaincodes[i].path
                    );
                }
                return details;
            } else {
                logger.error('response is null');
                return 'response is null';
            }
        } catch (error) {
            logger.error('Failed to query due to error: ' + error.stack ? error.stack : error);
            return error.toString();
        }
    };

    /**
     * Queries the target peer for the names of all the channels that a peer has joined.
     * @param {string} peerName 
     * @param {string} orgName 
     */
    async getChannels(peerName, orgName) {
        try {
            // first setup the client for this org
            var client = await common.getClientForOrg(orgName, userName);
            logger.debug('Successfully got the fabric client for the organization "%s"', orgName);

            let response = await client.queryChannels(peerName);
            if (response) {
                logger.debug('<<< channels >>>');
                var channelNames = [];
                for (let i = 0; i < response.channels.length; i++) {
                    channelNames.push('channel id: ' + response.channels[i].channel_id);
                }
                logger.debug(channelNames);
                return response;
            } else {
                logger.error('response_payloads is null');
                return 'response_payloads is null';
            }
        } catch (error) {
            logger.error('Failed to query due to error: ' + error.stack ? error.stack : error);
            return error.toString();
        }
    };

    /**
     * _generateBlockHash
     * @param {JSON} header 
     */
    async _generateBlockHash(header) {
        const headerAsn = asn.define('headerAsn', function () {
            this.seq().obj(
                this.key('Number').int(),
                this.key('PreviousHash').octstr(),
                this.key('DataHash').octstr()
            );
        });
        const output = headerAsn.encode({
            Number: parseInt(header.number),
            PreviousHash: Buffer.from(header.previous_hash, 'hex'),
            DataHash: Buffer.from(header.data_hash, 'hex')
        },
            'der'
        );
        return sha.sha256(output);
    }

    /**
     * crawlBlock
     * @param {string} blockNumberOrHash 
     * @param {JSON} option 
     */
    async crawlBlock(blockNumberOrHash, option) {
        try {
            let channel = await common.getChannel(orgName, userName, channelName);

            let blockResult = {}
            if (option == 'byNumber') {
                blockResult = await channel.queryBlock(blockNumberOrHash);
            } else {
                let buf = Buffer.from(blockNumberOrHash, "hex");
                blockResult = await channel.queryBlockByHash(buf);
            }
            if (blockResult) {
                let txs = blockResult.data.data;
                if (!txs) return null;
                const data = []
                const tx_code = blockResult.metadata.metadata[blockResult.metadata.metadata.length - 1];

                const block_hash = await this._generateBlockHash(blockResult.header);
                const header = {
                    number: blockResult.header.number,
                    previous_hash: blockResult.header.previous_hash,
                    data_hash: blockResult.header.data_hash,
                    block_hash: block_hash
                }
                blockResult.data.data.forEach(d => {
                    let tx = {};
                    tx.timestamp = d.payload.header.channel_header.timestamp;
                    tx.channel_id = d.payload.header.channel_header.channel_id;
                    tx.tx_id = d.payload.header.channel_header.tx_id;
                    tx.tx_type = d.payload.header.channel_header.typeString;
                    if (d.payload.data.actions[0]) {
                        tx.ns_rwset = d.payload.data.actions[0].payload.action.proposal_response_payload.extension.results.ns_rwset;
                    } else {
                        tx.ns_rwset = [];
                    }
                    data.push(tx);
                });
                //block structure to publish to queue
                let block = {
                    header,
                    data,
                    tx_code
                }
                return block;
            } else {
                return null;
            }
        } catch (err) {
            logger.error('Failed to query due to error: ' + error.stack ? error.stack : error);
            return error.toString();
        }
    }
}

module.exports = QueryService;