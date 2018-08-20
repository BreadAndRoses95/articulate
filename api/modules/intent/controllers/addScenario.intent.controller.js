'use strict';
const Async = require('async');
const Boom = require('boom');
const Flat = require('../../../helpers/flat');
const ScenarioTools = require('../tools');
const RemoveBlankArray = require('../../../helpers/removeBlankArray');

module.exports = (request, reply) => {

    let agentId = null;
    let domainId = null;
    let intentId = null;
    let scenario = request.payload;
    const redis = request.server.app.redis;

    Async.series({
        fathersCheck: (cb) => {

            Async.series([
                (callback) => {

                    redis.zscore('agents', scenario.agent, (err, id) => {

                        if (err){
                            const error = Boom.badImplementation('An error occurred checking if the agent exists.');
                            return callback(error);
                        }
                        if (id){
                            agentId = id;
                            return callback(null);
                        }
                        const error = Boom.badRequest(`The agent ${scenario.agent} doesn't exist`);
                        return callback(error, null);
                    });
                },
                (callback) => {

                    redis.zscore(`agentDomains:${agentId}`, scenario.domain, (err, id) => {

                        if (err){
                            const error = Boom.badImplementation(`An error occurred checking if the domain ${scenario.domain} exists in the agent ${scenario.agent}.`);
                            return callback(error);
                        }
                        if (id){
                            domainId = id;
                            return callback(null);
                        }
                        const error = Boom.badRequest(`The domain ${scenario.domain} doesn't exist in the agent ${scenario.agent}`);
                        return callback(error);
                    });
                },
                (callback) => {

                    Async.parallel([
                        (cllbk) => {

                            redis.zscore(`domainIntents:${domainId}`, scenario.intent, (err, id) => {

                                if (err){
                                    const error = Boom.badImplementation(`An error occurred checking if the intent ${scenario.intent} exists in the domain ${scenario.domain}.`);
                                    return cllbk(error);
                                }
                                if (id){
                                    intentId = id;
                                    return cllbk(null);
                                }
                                const error = Boom.badRequest(`The intent ${scenario.intent} doesn't exist in the domain ${scenario.domain}`);
                                return cllbk(error);
                            });
                        },
                        (cllbk) => {

                            ScenarioTools.validateEntitiesScenarioTool(redis, agentId, scenario.slots, (err) => {

                                if (err) {
                                    return cllbk(err);
                                }
                                return cllbk(null);
                            });
                        }
                    ], (err, result) => {

                        if (err){
                            return callback(err);
                        }
                        return callback(null);
                    });
                },
                (callback) => {

                    redis.exists(`scenario:${intentId}`, (err, exists) => {

                        if (err){
                            const error = Boom.badImplementation('An error occurred retrieving the scenario.');
                            return cb(error);
                        }
                        if (exists){
                            const error = Boom.badRequest('An scenario already exists for this intent. If you want to change it please use the update endpoint.');
                            return cb(error);
                        }
                        return cb(null);
                    });
                }
            ], (err) => {

                if (err){
                    return cb(err, null);
                }
                return cb(null);
            });
        },
        scenario: (cb) => {

            scenario = Object.assign({ id: intentId }, scenario);
            const flatScenario = RemoveBlankArray(Flat(scenario));
            redis.hmset(`scenario:${intentId}`, flatScenario, (err) => {

                if (err){
                    const error = Boom.badImplementation('An error occurred adding the scenario data.');
                    return cb(error);
                }
                return cb(null, scenario);
            });
        }
    }, (err, result) => {

        if (err){
            return reply(err, null);
        }
        if (scenario.parentIntent >= 0){
            let server = request.server;
            let parentIntentScenario;
            Async.series([

                (cb) => server.inject(`/intent/${scenario.parentIntent}/scenario`, (res) => {

                    if (res.statusCode !== 200) {
                        if (res.statusCode === 404) {
                            const error = Boom.notFound('The specified parent intent doesn\'t exists');
                            return cb(error);
                        }
                        const error = Boom.create(res.statusCode, `An error occurred getting the data of the parent intent ${intentId}`);

                        return cb(error);
                    }
                    parentIntentScenario = res.result;
                    delete parentIntentScenario.id;
                    delete parentIntentScenario.agent;
                    delete parentIntentScenario.domain;
                    delete parentIntentScenario.intent;
                    parentIntentScenario.followUpIntents.push(parseInt(intentId));
                    return cb(null);
                }),
                (cb) => {
                    let options = {
                        url: `/intent/${scenario.parentIntent}/scenario`,
                        method: 'PUT',
                        payload: parentIntentScenario};
                server.inject(options,(res)=>{
                    if (res.statusCode !== 200) {
                        const error = Boom.create(res.statusCode, `An error occurred updating the scenario of the parent intent ${parentIntentScenario.id}`);
                        return cb(error, null);
                    }
                    return cb(null);
                })}

            ],(err)=>{
                if (err)
                    return reply(err, null);
                else
                    return reply(result.scenario);
            })
        }
        else {
            return reply(result.scenario);
        }
    });
};
