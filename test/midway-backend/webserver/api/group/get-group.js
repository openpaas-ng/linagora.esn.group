'use strict';

const request = require('supertest');
const expect = require('chai').expect;
const path = require('path');
const ObjectId = require('mongoose').Types.ObjectId;

const MODULE_NAME = 'linagora.esn.group';

describe('The get group API: GET /groups/:id', () => {
  let app, deployOptions, lib;
  let adminUser, regularUser, domain, group;
  const password = 'secret';

  beforeEach(function(done) {
    this.helpers.modules.initMidway(MODULE_NAME, err => {
      if (err) {
        return done(err);
      }
      const groupApp = require(this.testEnv.backendPath + '/webserver/application')(this.helpers.modules.current.deps);
      const api = require(this.testEnv.backendPath + '/webserver/api')(this.helpers.modules.current.deps, this.helpers.modules.current.lib.lib);

      groupApp.use(require('body-parser').json());
      groupApp.use('/api', api);

      app = this.helpers.modules.getWebServer(groupApp);
      deployOptions = {
        fixtures: path.normalize(`${__dirname}/../../../fixtures/deployments`)
      };

      this.helpers.api.applyDomainDeployment('groupModule', deployOptions, (err, models) => {
        if (err) {
          return done(err);
        }
        adminUser = models.users[0];
        regularUser = models.users[1];
        domain = models.domain;
        lib = this.helpers.modules.current.lib.lib;
        lib.group.create({
            name: 'Group',
            domain_ids: [domain.id],
            email: 'example@lngr.com'
          })
          .then(createdGroup => {
            group = createdGroup;
            done();
          })
          .catch(done);
      });
    });
  });

  afterEach(function(done) {
    this.helpers.mongo.dropDatabase(err => {
      if (err) return done(err);
      this.testEnv.core.db.mongo.mongoose.connection.close(done);
    });
  });

  it('should respond 401 if not logged in', function(done) {
    this.helpers.api.requireLogin(app, 'get', `/api/groups/${group.id}`, done);
  });

  it('should respond 404 if group is not found', function(done) {
    this.helpers.api.loginAsUser(app, adminUser.emails[0], password, (err, requestAsMember) => {
      expect(err).to.not.exist;
      requestAsMember(request(app).get(`/api/groups/${new ObjectId()}`))
        .expect(404)
        .end((err, res) => {
          expect(err).to.not.exist;
          expect(res.body).to.deep.equal({
            error: { code: 404, message: 'Not Found', details: 'Group not found' }
          });
          done();
        });
    });
  });

  it('should respond 403 if the logged in user does not have permission to get group (group belongs to another domain)', function(done) {
    lib.group.create({
        name: 'Other Group',
        domain_ids: [new ObjectId()],
        email: 'example@abc.com'
      })
      .then(createdGroup => {
        this.helpers.api.loginAsUser(app, adminUser.emails[0], password, (err, requestAsMember) => {
          expect(err).to.not.exist;
          requestAsMember(request(app).get(`/api/groups/${createdGroup.id}`))
            .expect(403)
            .end((err, res) => {
              expect(err).to.not.exist;
              expect(res.body).to.deep.equal({
                error: {
                  code: 403,
                  message: 'Forbidden',
                  details: `You do not have permission to perfom action on this group: ${createdGroup.id}`
                }
              });
              done();
            });
        });
      })
      .catch(done);
  });

  it('should respond 200 with the group even if current user is not a domain admin', function(done) {
    this.helpers.api.loginAsUser(app, regularUser.emails[0], password, (err, requestAsMember) => {
      expect(err).to.not.exist;
      requestAsMember(request(app).get(`/api/groups/${group.id}`))
        .expect(200)
        .end((err, res) => {
          expect(err).to.not.exist;
          expect(res.body).to.shallowDeepEqual({ id: group.id });
          done();
        });
    });
  });

  it('should respond 200 with the requested group when current user is domain admin', function(done) {
    this.helpers.api.loginAsUser(app, adminUser.emails[0], password, (err, requestAsMember) => {
      expect(err).to.not.exist;

      requestAsMember(request(app).get(`/api/groups/${group.id}`))
        .expect(200)
        .end((err, res) => {
          expect(err).to.not.exist;
          expect(res.body).to.shallowDeepEqual({ id: group.id });
          done();
        });
    });
  });
});
