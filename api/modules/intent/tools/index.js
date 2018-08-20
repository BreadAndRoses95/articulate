'use strict';
const ValidateEntitiesTool = require('./validateEntities.intent.tool');
const ValidateEntitiesScenarioTool = require('./validateEntities.scenario.tool');
const UpdateEntitiesDomainTool = require('./updateEntitiesDomain.intent.tool');
const DeleteIntentTool = require('./deleteIntent.intent.tool');

const IntentTools = {

    validateEntitiesTool: ValidateEntitiesTool,

    validateEntitiesScenarioTool: ValidateEntitiesScenarioTool,

    updateEntitiesDomainTool: UpdateEntitiesDomainTool,

    deleteIntentTool: DeleteIntentTool
};

module.exports = IntentTools;
