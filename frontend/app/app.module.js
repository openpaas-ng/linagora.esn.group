(function(angular) {
  'use strict';

  var MODULE_NAME = 'linagora.esn.group';

  angular.module(MODULE_NAME, [
    'op.dynamicDirective',
    'restangular',
    'esn.router',
    'esn.member',
    'esn.http',
    'esn.infinite-list',
    'esn.core',
    'esn.user',
    'esn.async-action',
    'esn.session',
    'esn.attendee',
    'esn.scroll',
    'esn.ui',
    'esn.i18n',
    'esn.header'
  ]);
})(angular);
