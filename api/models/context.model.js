'use strict';

const Joi = require('joi');
class ScenarioModel {
    static get schema() {

        return {
            id: Joi.number(),
            name: Joi.string().trim(),
            scenario: Joi.string().trim(),
            slots: Joi.object(),
            followUpIntents: Joi.array().items(Joi.number())
        };
    };
}

module.exports = ScenarioModel;
