'use strict';

/* global chai: false */
/* global sinon: false */

var expect = chai.expect;

describe('The GroupListController', function() {
  var $rootScope, $controller, $scope;
  var $modalMock, infiniteScrollHelperMock;
  var GROUP_EVENTS;
  var groups;

  beforeEach(function() {
    infiniteScrollHelperMock = sinon.spy();
    $modalMock = {};
    groups = [{ foo: 'bar' }];

    angular.mock.module(function($provide) {
      $provide.value('infiniteScrollHelper', infiniteScrollHelperMock);
      $provide.value('$modal', $modalMock);
    });
  });

  beforeEach(function() {
    module('linagora.esn.group');

    inject(function(
      _$rootScope_,
      _$controller_,
      _groupApiClient_,
      _GROUP_EVENTS_
    ) {
      $rootScope = _$rootScope_;
      $controller = _$controller_;
      GROUP_EVENTS = _GROUP_EVENTS_;
    });
  });

  function initController() {
    $scope = $rootScope.$new();

    var controller = $controller('GroupListController', { $scope: $scope }, { elements: groups });

    controller.$onInit();
    $scope.$digest();

    return controller;
  }

  it('should call infiniteScrollHelper to load elements', function() {
    initController();

    expect(infiniteScrollHelperMock).to.have.been.called;
  });

  it('should push the new group on top of list when group created event fire', function() {
    var group = { baz: 'abc' };
    var expectGroups = angular.copy(groups);

    expectGroups.unshift(group);
    var controller = initController();

    $scope.$on = sinon.stub();
    $rootScope.$broadcast(GROUP_EVENTS.GROUP_CREATED, group);

    expect(controller.elements).to.deep.equal(expectGroups);
  });

  it('should remove deleted group when a group is deleted group', function() {
    var testGroup = { id: 'testgroup' };

    groups.push(testGroup);

    var controller = initController();

    expect(controller.elements).to.include(testGroup);

    $scope.$on = sinon.stub();
    $rootScope.$broadcast(GROUP_EVENTS.GROUP_DELETED, testGroup);

    expect(controller.elements).to.not.include(testGroup);
  });
});