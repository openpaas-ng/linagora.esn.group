'use strict';

const request = require('supertest');
const expect = require('chai').expect;
const path = require('path');
const ObjectId = require('mongoose').Types.ObjectId;

const MODULE_NAME = 'linagora.esn.group';

describe('The update group members API: POST /groups/:id/members', () => {
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
            email: 'example@lngr.com',
            domain_ids: [domain.id],
            members: [
              {
                member: {
                  id: 'outsider@external.org',
                  objectType: 'email'
                }
              }, {
                member: {
                  id: adminUser._id,
                  objectType: 'user'
                }
              }
            ]
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
    this.helpers.mongo.dropDatabase(done);
  });

  it('should respond 401 if not logged in', function(done) {
    this.helpers.api.requireLogin(app, 'post', `/api/groups/${group.id}/members`, done);
  });

  it('should return 400 if given action on member is not supported', function(done) {
    this.helpers.api.loginAsUser(app, adminUser.emails[0], password, (err, requestAsMember) => {
      expect(err).to.not.exist;
      requestAsMember(request(app).post(`/api/groups/${group.id}/members?action=invalid`).send([]))
        .expect(400)
        .end((err, res) => {
          expect(err).to.not.exist;
          expect(res.body.error.details).to.equal('invalid is not a valid action on members (add, remove)');
          done();
        });
    });
  });

  it('should respond 400 if the body is not an array', function(done) {
    const body = 'let us try a string';

    this.helpers.api.loginAsUser(app, adminUser.emails[0], password, (err, requestAsMember) => {
      expect(err).to.not.exist;
      requestAsMember(request(app).post(`/api/groups/${group.id}/members?action=add`).send(body))
        .expect(400)
        .end((err, res) => {
          expect(err).to.not.exist;
          expect(res.body.error.details).to.equal('body should be an array');
          done();
        });
    });
  });

  it('should respond 400 if the body is not an array of valid member tuples', function(done) {
    const body = [{ objectType: 'invalid objectType', id: 'whatever' }];

    this.helpers.api.loginAsUser(app, adminUser.emails[0], password, (err, requestAsMember) => {
      expect(err).to.not.exist;
      requestAsMember(request(app).post(`/api/groups/${group.id}/members?action=add`).send(body))
        .expect(400)
        .end((err, res) => {
          expect(err).to.not.exist;
          expect(res.body.error.details).to.equal('body must be an array of valid member tuples {objectType, id}');
          done();
        });
    });
  });

  it('should respond 404 if group is not found', function(done) {
    const body = [];

    this.helpers.api.loginAsUser(app, adminUser.emails[0], password, (err, requestAsMember) => {
      expect(err).to.not.exist;
      requestAsMember(request(app).post(`/api/groups/${new ObjectId()}/members?action=remove`).send(body))
        .expect(404)
        .end((err, res) => {
          expect(err).to.not.exist;
          expect(res.body.error.details).to.equal('Group not found');
          done();
        });
    });
  });

  it('should respond 403 if the logged in user does not have permission to remove group members (not a domain admin)', function(done) {
    const body = [];

    this.helpers.api.loginAsUser(app, regularUser.emails[0], password, (err, requestAsMember) => {
      expect(err).to.not.exist;
      requestAsMember(request(app).post(`/api/groups/${group.id}/members?action=add`).send(body))
        .expect(403)
        .end((err, res) => {
          expect(err).to.not.exist;
          expect(res.body).to.deep.equal({
            error: { code: 403, message: 'Forbidden', details: 'User is not the domain manager' }
          });
          done();
        });
    });
  });

  it('should respond 403 if the logged in user does not have permission to remove group members (group belongs to another domain)', function(done) {
    const body = [];

    lib.group.create({
        name: 'Other Group',
        domain_ids: [new ObjectId()],
        email: 'example@abc.com'
      })
      .then(createdGroup => {
        this.helpers.api.loginAsUser(app, adminUser.emails[0], password, (err, requestAsMember) => {
          expect(err).to.not.exist;
          requestAsMember(request(app).post(`/api/groups/${createdGroup.id}/members?action=add`).send(body))
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

  describe('The remove members API: POST /groups/:id/members?action=remove', function() {
    it('should respond 204 on success (remove external member)', function(done) {
      const body = [
        { objectType: 'email', id: 'outsider@external.org' }
      ];

      this.helpers.api.loginAsUser(app, adminUser.emails[0], password, (err, requestAsMember) => {
        expect(err).to.not.exist;
        requestAsMember(request(app).post(`/api/groups/${group.id}/members?action=remove`).send(body))
          .expect(204)
          .end(err => {
            expect(err).to.not.exist;

            lib.group.getById(group.id)
              .then(group => {
                expect(group.members).to.have.length(1);
                expect(group.members[0].member).to.shallowDeepEqual({ objectType: 'user', id: adminUser._id });
                done();
              })
              .catch(err => done(err || 'should resolve'));
          });
      });
    });

    it('should respond 204 on success (remove internal member)', function(done) {
      const body = [
        { objectType: 'user', id: adminUser.id }
      ];

      this.helpers.api.loginAsUser(app, adminUser.emails[0], password, (err, requestAsMember) => {
        expect(err).to.not.exist;
        requestAsMember(request(app).post(`/api/groups/${group.id}/members?action=remove`).send(body))
          .expect(204)
          .end(err => {
            expect(err).to.not.exist;

            lib.group.getById(group.id)
              .then(group => {
                expect(group.members).to.have.length(1);
                expect(group.members[0].member).to.deep.equal({ objectType: 'email', id: 'outsider@external.org' });
                done();
              })
              .catch(err => done(err || 'should resolve'));
          });
      });
    });
  });

  describe('The add members API: POST /api/groups/:id/members?action=add', function() {
    it('should return 200 without members which are invalid user or already existing member', function(done) {
      const members = [
        { id: new ObjectId(), objectType: 'user'},
        { id: adminUser.id, objectType: 'user'},
        { id: adminUser.preferredEmail, objectType: 'email'},
        { id: 'outsider@external.org', objectType: 'email' }
      ];

      this.helpers.api.loginAsUser(app, adminUser.emails[0], password, (err, requestAsMember) => {
        expect(err).to.not.exist;
        const req = requestAsMember(request(app).post(`/api/groups/${group.id}/members?action=add`));

        req.expect(200);
        req.send(members);
        req.end((err, res) => {
          expect(err).to.not.exist;
          expect(res.body.length).equal(0);
          done();
        });
      });
    });

    it('should return 200 with resolved added members', function(done) {
      const members = [
        { id: regularUser.preferredEmail, objectType: 'email'},
        { id: 'test@email.com', objectType: 'email'}
      ];

      this.helpers.api.loginAsUser(app, adminUser.emails[0], password, (err, requestAsMember) => {
        expect(err).to.not.exist;
        const req = requestAsMember(request(app).post(`/api/groups/${group.id}/members?action=add`));

        req.expect(200);
        req.send(members);
        req.end((err, res) => {
          expect(err).to.not.exist;
          expect(res.body.length).equal(2);
          expect(res.body[0]).to.shallowDeepEqual({
            id: regularUser.id,
            objectType: 'user',
            member: {
              id: regularUser.id
            }
          });
          expect(res.body[1]).to.shallowDeepEqual({
            id: 'test@email.com',
            objectType: 'email',
            member: 'test@email.com'
          });
          done();
        });
      });
    });
  });
});