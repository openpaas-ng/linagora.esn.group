'use strict';

const request = require('supertest');
const expect = require('chai').expect;
const path = require('path');
const Q = require('q');
const MODULE_NAME = 'linagora.esn.group';

describe('The groups API', () => {
  let user, app, deployOptions;
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
        fixtures: path.normalize(`${__dirname}/../../fixtures/deployments`)
      };

      this.helpers.api.applyDomainDeployment('groupModule', deployOptions, (err, models) => {
        if (err) {
          return done(err);
        }
        user = models.users[0];

        done();
      });
    });
  });

  afterEach(function(done) {
    this.helpers.mongo.dropDatabase(done);
  });

  describe('POST /groups', () => {
    it('should return 401 if not logged in', function(done) {
      this.helpers.api.requireLogin(app, 'post', '/api/groups', done);
    });

    it('should create a group', function(done) {
      const group = {
        name: 'groupname',
        email: 'group@linagora.com',
        members: []
      };

      this.helpers.api.loginAsUser(app, user.emails[0], password, (err, requestAsMember) => {
        if (err) {
          return done(err);
        }
        const req = requestAsMember(request(app).post('/api/groups'));

        req.send(group);
        req.expect(201);
        req.end((err, res) => {
          expect(err).to.not.exist;
          expect(res.body).to.shallowDeepEqual(group);
          done();
        });
      });
    });

    it('should create a group with a list of members', function(done) {
      const group = {
        name: 'groupname',
        email: 'group@linagora.com',
        members: [
          user.emails[0],
          'user@external.com'
        ]
      };

      this.helpers.api.loginAsUser(app, user.emails[0], password, (err, requestAsMember) => {
        if (err) {
          return done(err);
        }
        const req = requestAsMember(request(app).post('/api/groups'));

        req.send(group);
        req.expect(201);
        req.end((err, res) => {
          expect(err).to.not.exist;
          expect(res.body).to.shallowDeepEqual({
            name: 'groupname',
            email: 'group@linagora.com',
            members: [
              {
                member: {
                  objectType: 'user',
                  id: user.id
                }
              }, {
                member: {
                  objectType: 'email',
                  id: 'user@external.com'
                }
              }
            ]
          });
          done();
        });
      });
    });
  });

  describe('GET /groups', () => {

    it('should return 401 if not logged in', function(done) {
      this.helpers.api.requireLogin(app, 'post', '/api/groups', done);
    });

    it('should return 200 with a list of groups', function(done) {
      const lib = this.helpers.modules.current.lib.lib;
      const group1 = {
        name: 'group1',
        email: 'group1@lngr.com',
        members: []
      };
      const group2 = {
        name: 'group2',
        email: 'group2@lngr.com',
        members: []
      };

      Q.all([
        lib.group.create(group1),
        lib.group.create(group2)
      ]).spread((group_1, group_2) => {
        this.helpers.api.loginAsUser(app, user.emails[0], password, (err, requestAsMember) => {
          if (err) {
            return done(err);
          }
          const req = requestAsMember(request(app).get('/api/groups'));

          req.expect(200);
          req.end((err, res) => {
            expect(err).to.not.exist;
            expect(res.body).to.include(Object.assign({ id: String(group_1._id) }, group1));
            expect(res.body).to.include(Object.assign({ id: String(group_2._id) }, group2));
            done();
          });
        });
      })
      .catch(done);
    });
  });

  describe('GET /groups/:id', () => {
    it('should return 401 if not logged in', function(done) {
      this.helpers.api.requireLogin(app, 'post', '/api/groups', done);
    });

    it('should return 404 if group is not found', function(done) {
      this.helpers.api.loginAsUser(app, user.emails[0], password, (err, requestAsMember) => {
        if (err) {
          return done(err);
        }
        const req = requestAsMember(request(app).get('/api/groups/invalid'));

        req.expect(404);
        req.end(done);
      });
    });

    it('should return 200 with the requested group', function(done) {
      const lib = this.helpers.modules.current.lib.lib;
      const group = {
        name: 'Group',
        email: 'example@lngr.com',
        members: [
          {
            member: {
              id: 'outsider@external.org',
              objectType: 'email'
            }
          }, {
            member: {
              id: String(user._id),
              objectType: 'user'
            }
          }
        ]
      };

      lib.group.create(group)
        .then(created => this.helpers.api.loginAsUser(app, user.emails[0], password, (err, requestAsMember) => {
            if (err) {
              return done(err);
            }
            const req = requestAsMember(request(app).get(`/api/groups/${String(created._id)}`));

            req.expect(200);
            req.end((err, res) => {
              expect(err).to.not.exist;
              expect(res.body).to.shallowDeepEqual(Object.assign({ id: String(created._id) }, group));
              done();
            });
          }))
        .catch(done);
    });
  });
});