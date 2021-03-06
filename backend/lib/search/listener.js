const { SEARCH, EVENTS } = require('../constants');
const { denormalizeFromEvent, getId} = require('./denormalize');

module.exports = dependencies => {
  const listeners = dependencies('elasticsearch').listeners;

  return {
    getOptions,
    register
  };

  function getOptions() {
    return {
      events: {
        add: EVENTS.CREATED,
        remove: EVENTS.DELETED,
        update: EVENTS.UPDATED
      },
      denormalize: denormalizeFromEvent,
      getId,
      type: SEARCH.TYPE_NAME,
      index: SEARCH.INDEX_NAME
    };
  }

  function register() {
    return listeners.addListener(getOptions());
  }
};
