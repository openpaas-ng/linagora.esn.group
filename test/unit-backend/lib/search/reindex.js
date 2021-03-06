const { expect } = require('chai');
const mockery = require('mockery');
const sinon = require('sinon');

describe('The reindex group module', function() {
  let getModule;
  let elasticsearch;

  beforeEach(function() {
    elasticsearch = {
      reindexRegistry: {
        register: sinon.spy()
      }
    };

    this.moduleHelpers.addDep('elasticsearch', elasticsearch);
    getModule = () => require(`${this.moduleHelpers.backendPath}/lib/search/reindex`)(this.moduleHelpers.dependencies);
  });

  describe('The register function', function() {
    it('should register elasticsearch reindex options for groups', function() {
      mockery.registerMock('../group', () => ({}));

      getModule().register();
      expect(elasticsearch.reindexRegistry.register).to.have.been.calledOnce;
      expect(elasticsearch.reindexRegistry.register).to.have.been.calledWith(
        'groups',
        {
          name: 'groups.idx',
          buildReindexOptionsFunction: sinon.match.func
        }
      );
    });
  });
});
