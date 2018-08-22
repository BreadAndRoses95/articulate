'use strict';

module.exports = (conversationStateObject, callback) => {
    if (conversationStateObject.domain.isFollowUpDomain){
        if (!conversationStateObject.domain.isBlockingFollowUpDomain){
            conversationStateObject.currentContext.followUpIntents = [];
        }

    }
    const textResponse = conversationStateObject.agent.fallbackResponses[Math.floor(Math.random() * conversationStateObject.agent.fallbackResponses.length)];
    return callback(null, { textResponse } );
};
