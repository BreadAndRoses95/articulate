'use strict';
const Async = require('async');
const Boom = require('boom');
const Cast = require('../../../helpers/cast');
const formatRequest = require('../../formatRequest.util')


module.exports = (request, reply) => {

    const server = request.server;
    const agentId = request.params.id;
    const domainId = request.params.domainId;
    const intentId = request.params.intentId;
    let agentName;
    let domainName;

    Async.waterfall([
        (cb) => {

            server.inject(formatRequest(`/agent/${agentId}`), (res) => {

                if (res.statusCode !== 200){
                    if (res.statusCode === 404){
                        const errorNotFound = Boom.notFound('The specified agent doesn\'t exists');
                        return cb(errorNotFound);
                    }
                    const error = Boom.create(res.statusCode, 'An error occurred getting the data of the agent');
                    return cb(error, null);
                }
                agentName = res.result.agentName;
                return cb(null);
            });
        },
        (cb) => {

            server.inject(formatRequest(`/agent/${agentId}/domain/${domainId}`), (res) => {

                if (res.statusCode !== 200){
                    if (res.statusCode === 404){
                        const errorNotFound = Boom.notFound('The specified domain doesn\'t exists in this agent');
                        return cb(errorNotFound);
                    }
                    const error = Boom.create(res.statusCode, 'An error occurred getting the data of the domain');
                    return cb(error, null);
                }
                domainName = res.result.domainName;
                return cb(null);
            });
        },
        (cb) => {

            server.inject(formatRequest(`/intent/${intentId}`), (res) => {

                if (res.statusCode !== 200){
                    if (res.statusCode === 404){
                        const errorNotFound = Boom.notFound('The specified intent doesn\'t exists');
                        return cb(errorNotFound);
                    }
                    const error = Boom.create(res.statusCode, 'An error occurred getting the data of the intent');
                    return cb(error, null);
                }
                if (res.result && res.result.agent && res.result.agent === agentName && res.result.domain && res.result.domain === domainName){
                    return cb(null);
                }
                const errorNotFoundInDomain = Boom.badRequest('The specified intent is not linked with this domain');
                return cb(errorNotFoundInDomain);
            });
        },
        (cb) => {

            server.inject(formatRequest(`/intent/${intentId}/postFormat`), (res) => {

                if (res.statusCode !== 200){
                    if (res.statusCode === 404){
                        const errorNotFound = Boom.notFound('The specified post format doesn\'t exists');
                        return cb(errorNotFound);
                    }
                    const error = Boom.create(res.statusCode, 'An error occurred getting the data of the post format');
                    return cb(error, null);
                }
                return cb(null, res.result);
            });
        }
    ], (err, result) => {

        if (err) {
            return reply(err, null);
        }
        return reply(Cast(result, 'postFormat'));
    });
};
