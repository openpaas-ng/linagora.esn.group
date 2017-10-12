'use strict';

/* global chai: false */
/* global sinon: false */

var expect = chai.expect;

describe('The groupDisplay component', function() {
  var $rootScope, $compile, $q, $modal;
  var groupApiClient, GROUP_EVENTS;
  var group;

  beforeEach(function() {
    module('jadeTemplates');
    angular.mock.module('linagora.esn.group', function($provide) {
      $provide.value('infiniteScrollHelper', angular.noop);
      $provide.value('$modal', sinon.spy());
    });
  });

  beforeEach(inject(function(
    _$rootScope_,
    _$compile_,
    _$q_,
    _$modal_,
    _groupApiClient_,
    _GROUP_EVENTS_
  ) {
    $rootScope = _$rootScope_;
    $compile = _$compile_;
    $q = _$q_;
    $modal = _$modal_;
    groupApiClient = _groupApiClient_;
    GROUP_EVENTS = _GROUP_EVENTS_;
  }));

  beforeEach(function() {
    group = {
      id: 'groupId',
      name: 'Group name',
      email: 'group@email.com'
    };

    groupApiClient.get = function() {
      return $q.when({ data: group });
    };
  });

  function initComponent() {
    var scope = $rootScope.$new();
    var element = $compile('<group-display />')(scope);

    scope.$digest();

    return element;
  }

  it('should display basic information of group', function() {
    var elementHtml = initComponent().html();

    expect(elementHtml).to.contain(group.name);
    expect(elementHtml).to.contain(group.email);
  });

  it('should display member list', function() {
    var element = initComponent();

    expect(element.find('group-member-list')).to.have.length(1);
  });

  it('should update information of group on update event', function() {
    var element = initComponent();
    var updatedGroup = {
      id: group.id,
      name: 'Another group name',
      email: 'another.group@email.com'
    };

    $rootScope.$broadcast(GROUP_EVENTS.GROUP_UPDATED, updatedGroup);
    $rootScope.$digest();

    expect(element.html()).to.contain(updatedGroup.name);
    expect(element.html()).to.contain(updatedGroup.email);
  });

  it('should open update dialog when edit button is clicked', function() {
    var element = initComponent();

    element.find('[ng-click="$ctrl.onEditBtnClick()"]').click();

    expect($modal).to.have.been.calledWith(sinon.match({
      templateUrl: '/group/app/update/group-update.html',
      controller: 'GroupUpdateController'
    }));
  });
});
