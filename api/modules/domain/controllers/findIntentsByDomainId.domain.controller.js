'use strict';
const Async = require('async');
const Boom = require('boom');
const _ = require('lodash');
const formatRequest = require('../../formatRequest.util')


module.exports = (request, reply) => {

    const server = request.server;
    const redis = server.app.redis;
    let start = 0;
    if (request.query && request.query.start > -1) {
        start = request.query.start;
    }
    let limit = -1;
    if (request.query && request.query.limit > -1) {
        limit = request.query.limit;
    }
    let filter = '';
    if (request.query.filter && request.query.filter.trim() !== '') {
        filter = request.query.filter;
    }
    let total = 0;
    const domainId = request.params.id;

    Async.waterfall([
            (cb) => {

                server.inject(formatRequest(`/domain/${domainId}`), (res) => {

                    if (res.statusCode !== 200) {
                        if (res.statusCode === 404) {
                            const error = Boom.notFound('The specified domain doesn\'t exists');
                            return cb(error, null);
                        }
                        const error = Boom.create(res.statusCode, 'An error occurred getting the domain');
                        return cb(error, null);
                    }
                    return cb(null);
                });
            },
            (cb) => {

                redis.zrange(`domainIntents:${domainId}`, 0, -1, 'withscores', (err, intents) => {

                    if (err) {
                        const error = Boom.badImplementation('An error occurred getting the intents of the domain from the sorted set.');
                        return cb(error);
                    }
                    intents = _.chunk(intents, 2);
                    total = intents.length;
                    if (filter && filter !== '') {
                        intents = _.filter(intents, (intent) => {

                            return intent[0].toLowerCase().indexOf(filter.toLowerCase()) !== -1;
                        });
                        total = intents.length;
                    }
                    intents = _.sortBy(_.map(intents, (intent) => {

                        return {intentName: intent[0], id: intent[1]};
                    }), 'intentName');
                    if (limit !== -1) {
                        intents = intents.slice(start, limit);
                    }
                    return cb(null, intents);
                });
            },
            (intents, cb) => {

                Async.map(intents, (intent, callback) => {
                        Async.parallel({
                                intent: (cbIntent) => {
                                    server.inject(formatRequest('/intent/' + intent.id), (res) => {

                                        if (res.statusCode !== 200) {
                                            const error = Boom.create(res.statusCode, `An error occurred getting the data of the intent ${intent.id}`);
                                            return cbIntent(error, null);
                                        }
                                        return cbIntent(null, res.result);
                                    });
                                },
                                scenario: (cbScenario) => {

                                    server.inject(formatRequest('/intent/' + intent.id + '/scenario'), (res) => {

                                        if (res.statusCode !== 200) {
                                            const error = Boom.create(res.statusCode, `An error occurred getting the scenario of the intent ${intent.id}`);
                                            return cbScenario(error, null);
                                        }
                                        if (res.result.followUpIntents.length > 0) {
                                            let followUpDomainId;
                                            let agentId;
                                            Async.waterfall([
                                                    (callbackGetAgentId) => {
                                                        redis.zscore('agents', res.result.agent, (err, score) => {

                                                            if (err) {
                                                                const error = Boom.badImplementation(`An error occurred retrieving the id of the agent ${intent.agent}`);
                                                                return callbackGetAgentId(error);
                                                            }
                                                            agentId = score;
                                                            return callbackGetAgentId(null);
                                                        });
                                                    },
                                                    (callbackGetDomain) => {

                                                        redis.zscore(`agentDomains:${agentId}`, 'FollowUp-' + intent.id, (err, score) => {

                                                            if (err) {
                                                                const error = Boom.badImplementation(`An error occurred retrieving the id of the domain ${intent.domain}`);
                                                                return callbackGetDomain(error);
                                                            }
                                                            followUpDomainId = score;
                                                            return callbackGetDomain(null);
                                                        });
                                                    }],
                                                (err) => {
                                                    if (err) {
                                                        return cbScenario(err);
                                                    }
                                                    else {
                                                        return cbScenario(null, Object.assign(res.result, {followUpDomainId: parseInt(followUpDomainId)}));
                                                    }
                                                }
                                            );
                                        }
                                        else
                                            return cbScenario(null, res.result);
                                    });

                                }
                            }, (err, result) => {
                                if (err)
                                    return callback(err, null)
                                else {
                                    let resultCompletedIntent = Object.assign(result.intent, {
                                        parentIntent: result.scenario.parentIntent,
                                        followUpIntents: result.scenario.followUpIntents,
                                        followUpDomainId: result.scenario.followUpDomainId
                                    });
                                    if (result.scenario.parentIntent > -1){
                                        let agentId;
                                        Async.waterfall([
                                            (cbGetAgentId) => {
                                                    redis.zscore('agents', resultCompletedIntent.agent, (err, score) => {

                                                        if (err) {
                                                            const error = Boom.badImplementation(`An error occurred retrieving the id of the agent ${intent.agent}`);
                                                            return cbGetAgentId(error);
                                                        }
                                                        agentId = score;
                                                        return cbGetAgentId(null);
                                                    });
                                            },
                                            (cbFindParentIntent) => {
                                                server.inject(formatRequest('/intent/' + resultCompletedIntent.parentIntent), (res) => {

                                                    if (res.statusCode !== 200) {
                                                        const error = Boom.create(res.statusCode, `An error occurred getting the data of the parent intent ${resultCompletedIntent.parentIntent}`);
                                                        return cbFindParentIntent(error, null);
                                                    }
                                                    return cbFindParentIntent(null, res.result.domain);
                                                });
                                            },
                                            (domainParent,callbackGetDomainParent) => {
                                                redis.zscore(`agentDomains:${agentId}`, domainParent, (err, score) => {

                                                    if (err) {
                                                        const error = Boom.badImplementation(`An error occurred retrieving the id of the domain ${domainParent}`);
                                                        return callbackGetDomainParent(error);
                                                    }
                                                    return callbackGetDomainParent(null,score);
                                                });
                                            }
                                        ],(err,parentDomainId)=>{
                                            if (err)
                                                return callback(err,null)
                                            resultCompletedIntent = Object.assign(resultCompletedIntent,{parentDomainId: parseInt(parentDomainId)})
                                            return callback(null,resultCompletedIntent)
                                        })
                                    }
                                    else
                                        return callback(null, resultCompletedIntent)
                                }
                            }
                        )

                    },
                    (err, result) => {

                        if (err) {
                            return cb(err, null);
                        }
                        return cb(null, {intents: result, total});
                    }
                )
                ;
            }
        ],
        (err, result) => {

            if (err) {
                return reply(err, null);
            }
            return reply(result);
        }
    )
    ;
}
;
