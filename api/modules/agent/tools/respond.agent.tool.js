'use strict';
const Async = require('async');
const Boom = require('boom');
const _ = require('lodash');
const RespondIntent = require('./respondIntent.agent.tool');
const RespondFallback = require('./respondFallback.agent.tool');
const AgentTools = require('../tools');


const getCurrentContext = (conversationStateObject) => {

    if (conversationStateObject.context.length > 0) {
        return conversationStateObject.context[conversationStateObject.context.length - 1];
    }
    return null;
};

const recognizedEntitiesArePartOfTheContext = (currentContext, recognizedEntities) => {

    let results = _.map(recognizedEntities, (recognizedEntity) => {

        return Object.keys(currentContext.slots).indexOf(recognizedEntity.entity) > -1;
    });
    results = _.compact(results);
    return results.length > 0;
};

const getEntitiesFromRasaResults = (conversationStateObject) => {

    const entities = _.flatMap(conversationStateObject.parse, (domain) => {

        domain.entities = _.map(domain.entities, (entity) => {

            entity.domain = domain.domain;
            return entity;
        });
        return domain.entities;
    });

    return entities;
};

const getBestRasaResult = (conversationStateObject) => {

    let rasaResult = {};
    const normalDomainsName = conversationStateObject.agent.domains.map((domain)=>{
        if (!domain.isFollowUpDomain){
            return domain.domainName;
        }
    }).filter((domainName)=>{return domainName;});

    if (conversationStateObject.currentContext && conversationStateObject.currentContext.followUpIntents && conversationStateObject.currentContext.followUpIntents.length >0){
        //let's keep follow up domain parse only
        conversationStateObject.parse = conversationStateObject.parse.filter((domainParsed)=>{
            return domainParsed.domain === 'FollowUp-' + conversationStateObject.lastIntent.id;
        })
        rasaResult.entities = getEntitiesFromRasaResults(conversationStateObject); //TODO: could change this to keep track of domain on ID only and allow renaming
    }
    else {
        // Not in follow up case, keep only the normal domains.
        conversationStateObject.parse = conversationStateObject.parse.filter((domainParsed)=>{
            return normalDomainsName.indexOf(domainParsed.domain) > -1;
        })
    }

    const recognizedDomain = conversationStateObject.parse[0];


    if (conversationStateObject.parse.length > 0 && recognizedDomain.domainScore > conversationStateObject.agent.domainClassifierThreshold) {
        rasaResult = recognizedDomain;
    }
    else {
        if (conversationStateObject.parse.length === 1) {
            rasaResult = recognizedDomain;
        }
        else {
            rasaResult.entities = getEntitiesFromRasaResults(conversationStateObject);
        }
    }

    return rasaResult;
};

const getScenarioByName = (scenarioName, conversationStateObject) => {

    const agentIntents = _.compact(_.flatten(_.map(conversationStateObject.agent.domains, 'intents')));
    const agentScenarios = _.compact(_.map(agentIntents, 'scenario'));
    const scenario = _.filter(agentScenarios, (agentScenario) => {

        return agentScenario.scenarioName === scenarioName;
    })[0];
    return scenario;
};

const getIntentByName = (intentName, conversationStateObject) => {

    const agentIntents = _.compact(_.flatten(_.map(conversationStateObject.agent.domains, 'intents')));
    const intent = _.filter(agentIntents, (agentIntent) => {

        return agentIntent.intentName === intentName;
    })[0];
    return intent;
};

const getDomainOfIntent = (conversationStateObject) => {

    if (conversationStateObject.intent) {
        const domain = _.filter(conversationStateObject.agent.domains, (agentDomain) => {

            return agentDomain.domainName === conversationStateObject.intent.domain;
        })[0];
        return domain;
    }
    return null;
};

const getIntentData = (conversationStateObject) => {

    if (conversationStateObject.rasaResult.intent) {
        if (conversationStateObject.agent.domains) {
            const agentIntents = _.compact(_.flatten(_.map(conversationStateObject.agent.domains, 'intents')));
            //This is useless since we've filtered the rasaResult
            // if (conversationStateObject.currentContext && conversationStateObject.currentContext.followUpIntents && conversationStateObject.currentContext.followUpIntents.length >0){
            //     const followUpIntentsName = conversationStateObject.currentContext.followUpIntents.map((followUpIntentId) => {
            //         return agentIntents.filter((agentIntent)=>{
            //             return agentIntent.id === followUpIntentId;
            //         })[0].intentName
            //     });
            //
            //     const intentLit = _.filter(conversationStateObject.rasaResult.intent_ranking, (intentFound)=>{
            //         return followUpIntentsName.indexOf(intentFound.name) > -1
            //     });
            //     const intent = intentLit[0];
            //     conversationStateObject.rasaResult.intent = intent;
            //     // conversationStateObject.rasaResult.intent.confidence = 1;
            // }
            //should not be able to 
            const intent = _.filter(agentIntents, (agentIntent) => {
                return agentIntent.intentName === conversationStateObject.rasaResult.intent.name ;
            })[0];
            return intent;
        }
        return null;
    }
    return null;
};

const getPreviousIntentData = (conversationStateObject) => {

    if (conversationStateObject.currentContext && conversationStateObject.currentContext.name) {

        const agentIntents = _.compact(_.flatten(_.map(conversationStateObject.agent.domains, 'intents')));
        const intent = _.filter(agentIntents, (agentIntent) => {

            return agentIntent.intentName === conversationStateObject.currentContext.name;
        })[0];
        return intent;
    }
    return null;
};

const getLastContextWithValidSlots = (conversationStateObject, recognizedEntities) => {

    const recognizedEntitiesNames = _.map(recognizedEntities, 'entity');
    let keepGoing = true;
    let contextIndex = conversationStateObject.context.length - 1;
    let lastValidContext = null;
    while (keepGoing && contextIndex !== -1) {

        const contextSlots = conversationStateObject.context[contextIndex].slots ? Object.keys(conversationStateObject.context[contextIndex].slots) : [];
        const intersection = _.intersection(recognizedEntitiesNames, contextSlots);
        if (intersection.length > 0) {
            keepGoing = false;
            lastValidContext = _.cloneDeep(conversationStateObject.context[contextIndex]);
        }
        contextIndex--;
    }
    return lastValidContext;
};


const findIsActionIncomplete = (conversationStateObject) => {
    let previousIsActionIncomplete = false;
    let isActionIncomplete = false;
    if (conversationStateObject.lastIntent) {
        const requiredSlots = _.filter(conversationStateObject.lastIntent.scenario.slots, (slot) => {

            //conversationStateObject.context[conversationStateObject.context.length - 1].slots[slot.slotName] = conversationStateObject.currentContext.slots[slot.slotName] ? conversationStateObject.currentContext.slots[slot.slotName] : '';
            return slot.isRequired;
        });
        const recognizedEntities = conversationStateObject.rasaResult.entities;

        const recognizedEntitiesNames = _.map(recognizedEntities, (recognizedEntity) => {
            return recognizedEntity.entity;
        });
        if (conversationStateObject.currentContext.slots) {
            let previouslyFoundEntities = _.filter(Object.keys(conversationStateObject.currentContext.slots), (slot) => {
                return conversationStateObject.currentContext.slots[slot] !== "";
            });
            if (recognizedEntitiesNames.length > 0) {
                recognizedEntitiesNames.push(previouslyFoundEntities);
            }
            const previouslymissingEntities = _.filter(requiredSlots, (slot) => {

                return previouslyFoundEntities.indexOf(slot.entity) === -1 && !conversationStateObject.currentContext.slots[slot.slotName];
            });
            if (previouslymissingEntities.length > 0) {
                previousIsActionIncomplete = true;
            }
        }

        const missingEntities = _.filter(requiredSlots, (slot) => {

            return recognizedEntitiesNames.indexOf(slot.entity) === -1 && !conversationStateObject.currentContext.slots[slot.slotName];
        });
        if (missingEntities.length > 0) {
            isActionIncomplete = true;
        }
        return previousIsActionIncomplete;
    }
    return false;
}


const persistContext = (server, conversationStateObject, cb) => {

    Async.map(conversationStateObject.context, (elementInContext, callbackInsertInContext) => {

        if (elementInContext.id ) {
            if (elementInContext.slots || elementInContext.followUpIntents) {
                const options = {
                    url: `/context/${conversationStateObject.sessionId}/${elementInContext.id}`,
                    method: 'PUT',
                    payload: {
                        slots: elementInContext.slots,
                        followUpIntents : elementInContext.followUpIntents
                    }
                };

                server.inject(options, (res) => {

                    if (res.statusCode !== 200) {
                        const error = Boom.create(res.statusCode, `An error occurred updating the context ${elementInContext.id} of the session ${conversationStateObject.sessionId}`);
                        return callbackInsertInContext(error, null);
                    }
                    return callbackInsertInContext(null);
                });
            }
            else {
                return callbackInsertInContext(null);
            }
        }
        else {

            if (elementInContext.slots && Object.keys(elementInContext.slots).length === 0) {
                delete elementInContext.slots;
            }
            const options = {
                url: `/context/${conversationStateObject.sessionId}`,
                method: 'POST',
                payload: elementInContext
            };

            server.inject(options, (res) => {

                if (res.statusCode !== 200) {
                    const error = Boom.create(res.statusCode, `An error occurred adding the a new element to the session ${conversationStateObject.sessionId}`);
                    return callbackInsertInContext(error, null);
                }
                return callbackInsertInContext(null);
            });
        }
    }, (err) => {

        if (err) {
            return cb(err);
        }
        return cb(null);
    });
};

module.exports = (server, conversationStateObject,  callback, followUpIntent = false) => {
    var isActionIncomplete = false;

    conversationStateObject.currentContext = getCurrentContext(conversationStateObject);
    conversationStateObject.lastIntent = getPreviousIntentData(conversationStateObject);
    if (conversationStateObject.parse) {
        conversationStateObject.rasaResult = getBestRasaResult(conversationStateObject);

        isActionIncomplete = findIsActionIncomplete(conversationStateObject);

        // If last action was complete : we just moved from one intent to the same/another
        if ((!conversationStateObject.currentContext ||  !isActionIncomplete) || (conversationStateObject.lastIntent !== null && !conversationStateObject.lastIntent.scenario.isBlockingIntent)) {
                conversationStateObject.intent = getIntentData(conversationStateObject);
        }
        else {
            conversationStateObject.intent = conversationStateObject.lastIntent;
            conversationStateObject.rasaResult.intent.name = conversationStateObject.intent.intentName;
            conversationStateObject.rasaResult.intent.confidence = 1;
        }
        conversationStateObject.scenario = conversationStateObject.intent ? conversationStateObject.intent.scenario : null;
        if (conversationStateObject.intent && !conversationStateObject.scenario) {
            RespondFallback(conversationStateObject, (err, response) => {

                if (err) {
                    return callback(err, null);
                }
                persistContext(server, conversationStateObject, (err) => {

                    if (err) {
                        return callback(err);
                    }
                    return callback(null, response);
                });
            });
        }
        else {
            //TODO : remove this,  generic case
            conversationStateObject.domain = getDomainOfIntent(conversationStateObject);
            if (conversationStateObject.intent && conversationStateObject.scenario && conversationStateObject.domain && conversationStateObject.rasaResult.intent.confidence > conversationStateObject.domain.intentThreshold) {
                if (!conversationStateObject.currentContext || (conversationStateObject.rasaResult.intent.name !== conversationStateObject.currentContext.name)) {
                    let slots = {};
                    if (conversationStateObject.currentContext && conversationStateObject.currentContext.followUpIntents && conversationStateObject.currentContext.followUpIntents.length > 0){
                        slots = Object.assign(slots,conversationStateObject.currentContext.slots);
                    }
                    conversationStateObject.context.push({
                        name: conversationStateObject.rasaResult.intent.name,
                        scenario: conversationStateObject.scenario.scenarioName,
                        slots: slots
                    });
                    conversationStateObject.currentContext = getCurrentContext(conversationStateObject);
                }
                RespondIntent(conversationStateObject, (err, response) => {

                    if (err) {
                        return callback(err, null);
                    }
                    persistContext(server, conversationStateObject, (err) => {

                        if (err) {
                            return callback(err);
                        }
                        return callback(null, response);
                    });


                });
            }
            else {
                //TODO : remove this : confidence lower than threshold : should not happen
                const recognizedEntities = !conversationStateObject.rasaResult.intent ? conversationStateObject.rasaResult.entities : getEntitiesFromRasaResults(conversationStateObject.parse);
                if (conversationStateObject.currentContext) {
                    if (recognizedEntities.length > 0) {
                        if (conversationStateObject.currentContext.slots && Object.keys(conversationStateObject.currentContext.slots).length > 0 && recognizedEntitiesArePartOfTheContext(conversationStateObject.currentContext, recognizedEntities)) {
                            conversationStateObject.scenario = getScenarioByName(conversationStateObject.currentContext.scenario, conversationStateObject);
                            conversationStateObject.intent = getIntentByName(conversationStateObject.currentContext.name, conversationStateObject);
                            RespondIntent(conversationStateObject, (err, response) => {

                                if (err) {
                                    return callback(err, null);
                                }
                                persistContext(server, conversationStateObject, (err) => {

                                    if (err) {
                                        return callback(err);
                                    }
                                    return callback(null, response);
                                });
                            });
                        }
                        else {
                            const lastValidContext = getLastContextWithValidSlots(conversationStateObject, recognizedEntities);
                            if (lastValidContext) {
                                conversationStateObject.context.push(lastValidContext);
                                conversationStateObject.currentContext = lastValidContext;
                                conversationStateObject.scenario = getScenarioByName(conversationStateObject.currentContext.scenario, conversationStateObject);
                                conversationStateObject.intent = getIntentByName(conversationStateObject.currentContext.name, conversationStateObject);
                                RespondIntent(conversationStateObject, (err, response) => {

                                    if (err) {
                                        return callback(err, null);
                                    }
                                    persistContext(server, conversationStateObject, (err) => {

                                        if (err) {
                                            return callback(err);
                                        }
                                        return callback(null, response);
                                    });
                                });
                            }
                            else {
                                RespondFallback(conversationStateObject, (err, response) => {

                                    if (err) {
                                        return callback(err, null);
                                    }
                                    return callback(response);
                                });
                            }
                        }
                    }
                    else {
                        RespondFallback(conversationStateObject, (err, response) => {

                            if (err) {
                                return callback(err, null);
                            }
                            persistContext(server, conversationStateObject, (err) => {

                                if (err) {
                                    return callback(err);
                                }
                                return callback(null, response);
                            });
                        });
                    }
                }
                else {
                    RespondFallback(conversationStateObject, (err, response) => {

                        if (err) {
                            return callback(err, null);
                        }
                        return callback(response);
                    });
                }
            }
        }
    }
    else {
        const message = 'Sorry but the NLU engine didn\'t were able to parse your text';
        const error = Boom.badImplementation(message);
        return callback(error, null);
    }
};
