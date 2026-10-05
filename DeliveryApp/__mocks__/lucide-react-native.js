const React = require('react');
module.exports = new Proxy({}, {
  get: function(target, name) {
    if (name === '__esModule') return true;
    return function MockIcon(props) {
      return React.createElement('MockIcon', { ...props, 'data-icon-name': name });
    };
  }
});
