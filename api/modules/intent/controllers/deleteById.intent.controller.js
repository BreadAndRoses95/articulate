'use strict';
const Async = require('async');
const Boom = require('boom');
const IntentTools = require('../tools');
const Status = require('../../../helpers/status.json');

module.exports = (request, reply) => {

    const intentId = request.params.id;
    const server = request.server;
    const redis = server.app.redis;
    let followUpIntents;

    const getScenario = (intentId) => new Promise((resolve, reject) => {
        // let followUpIntents = [];

        server.inject(`/intent/${intentId}/scenario`, (res) => {

            if (res.statusCode !== 200) {
                if (res.statusCode === 404) {
                    const error = Boom.notFound('The specified intent doesn\'t exists');
                    // return resolve([]);
                }
                const error = Boom.create(res.statusCode, `An error occurred getting the data of the intent ${intentId}`);

                // return resolve([]);
            }
            return resolve(res.result);

        });
    });
    const intentsToDelete = [];

    function getTreeRecursively(id) {
        return getScenario(id, server).then(function (intent) {
            let node = {id};
            if (!intent.followUpIntents){
                node.children = [];
                return Promise.resolve(node);
            }
            return Promise.all(intent.followUpIntents.map(getTreeRecursively)).then(function (followUpIntentFound) {
                node.children = followUpIntentFound.followUpIntents;
                intentsToDelete.push(id);
                return node;
            });
        });
    }

    Async.waterfall([
            (cb) => {
                getTreeRecursively(intentId, server).then((tree) => {
                    cb(null);
                }).catch();
            },
            (cb) => {
                getScenario(intentId).then((scenario) => {
                    if (scenario.parentIntent >= 0) {
                        getScenario(scenario.parentIntent).then((parentIntentScenario) => {
                            parentIntentScenario.followUpIntents = parentIntentScenario.followUpIntents.filter((item) => {
                                return item !== intentId;
                            });
                            delete parentIntentScenario.id;
                            delete parentIntentScenario.agent;
                            delete parentIntentScenario.domain;
                            delete parentIntentScenario.intent;
                            let options = {
                                url: `/intent/${scenario.parentIntent}/scenario`,
                                method: 'PUT',
                                payload: parentIntentScenario
                            };
                            server.inject(options, (res) => {
                                if (res.statusCode !== 200) {
                                    const error = Boom.create(res.statusCode, `An error occurred updating the scenario of the parent intent ${parentIntentScenario.id}`);
                                    return cb(error, null);
                                }
                                return cb(null);
                            });
                        });
                    }
                    else
                        return cb(null);
                })
            },

            (cb) => {
                Async.forEach(intentsToDelete, (followUpIntent, callback) => {

                    IntentTools.deleteIntentTool(server, redis, followUpIntent, (err, result) => {
                        if (err) {
                            return callback(err, null);
                        }
                        let {intent, agentId, domainId, examples} = result;
                        IntentTools.updateEntitiesDomainTool(server, redis, {
                            domain: intent.domain,
                            examples: []
                        }, agentId, domainId, examples, (err) => {

                            if (err) {
                                return callback(err);
                            }
                            redis.hmset(`agent:${agentId}`, {status: Status.outOfDate}, (err) => {

                                if (err) {
                                    const error = Boom.badImplementation('An error occurred updating the agent status.');
                                    return callback(error, null);
                                }
                                redis.hmset(`domain:${domainId}`, {status: Status.outOfDate}, (err) => {

                                    if (err) {
                                        const error = Boom.badImplementation('An error occurred updating the domain status.');
                                        return callback(error, null);
                                    }
                                    return callback(null, {message: 'successful operation'});
                                });
                            });
                        });
                    })
                }, (err, result) => {
                    if (err) {
                        return cb(err, null);
                    }
                    else {
                        return cb(null, result)
                    }

                });
            }

        ],
        (err, result) => {
            if (err) {
                return reply(err, null);
            }
            else
                return reply(null, result).code(200);
        }
    )
}
;



