import { createSelector } from 'reselect';
import {selectGlobal} from "../App/selectors";

const selectIntent = (state) => state.intent;

const makeSelectIntentData = () => createSelector(
  selectIntent,
  (intentState) => intentState.intentData,
);

const makeSelectParentScenario = () => createSelector(
  selectIntent,
  (intentState) => intentState.parentScenario,
);

const makeSelectScenarioData = () => createSelector(
  selectIntent,
  (scenarioState) => scenarioState.scenarioData,
);

const makeSelectWebhookData = () => createSelector(
  selectIntent,
  (scenarioState) => scenarioState.webhookData,
);

const makeSelectPostFormatData = () => createSelector(
  selectIntent,
  (intentState) => intentState.postFormatData,
);

const makeSelectOldIntentData = () => createSelector(
  selectIntent,
  (intentState) => intentState.oldIntent,
);

const makeSelectOldScenarioData = () => createSelector(
  selectIntent,
  (scenarioState) => scenarioState.oldScenario,
);

const makeSelectOldWebhookData = () => createSelector(
  selectIntent,
  (scenarioState) => scenarioState.oldWebhook,
);

const makeSelectWindowSelection = () => createSelector(
  selectIntent,
  (intentState) => intentState.windowSelection,
);

const makeSelectTouched = () => createSelector(
  selectIntent,
  (intentState) => intentState.touched,
);
const makeSelectSelectedFollowUpIntents = () => createSelector(
  selectIntent,
  (intentState) => intentState.selectedFollowUpIntents
);
const makeSelectParentIntent = () => createSelector(
  selectIntent,
  (intentState) => intentState.parentIntent
);

export {
  selectIntent,
  makeSelectWindowSelection,
  makeSelectIntentData,
  makeSelectScenarioData,
  makeSelectWebhookData,
  makeSelectOldIntentData,
  makeSelectOldScenarioData,
  makeSelectOldWebhookData,
  makeSelectTouched,
  makeSelectPostFormatData,
  makeSelectSelectedFollowUpIntents,
  makeSelectParentIntent,
  makeSelectParentScenario
};
