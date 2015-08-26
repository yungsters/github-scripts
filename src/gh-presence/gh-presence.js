Parse.initialize('APPLICATION_ID', 'JAVASCRIPT_KEY');

var Session = Parse.Object.extend('Session');

var _config;
function getConfig() {
  return _config = _config || Parse.Config.get().then(function(config) {
    return {
      sessionTimeout: config.get('sessionTimeout') * 1000,
      networkLatency: config.get('networkLatency') * 1000,
      updateInterval: config.get('updateInterval') * 1000
    };
  });
}

function getUser() {
  if (window.location.hash.length > 1) {
    return window.location.hash.substr(1);
  }
  var avatar = document.querySelector('.user-nav .avatar');
  if (avatar) {
    return avatar.alt.substr(1); // @username
  }
  return null;
}

function getPath() {
  var captures = window.location.pathname.match(
    /^(\/[^/]+\/[^/]+\/(?:pull|issues)\/\d+)/
  );
  if (captures) {
    return captures[1];
  }
  return null;
}

function addNavigationListener(callback) {
  var pjaxContainer = document.getElementById('js-repo-pjax-container');
  if (pjaxContainer) {
    var observer = new MutationObserver(function(mutations) {
      mutations.some(function(mutation) {
        for (var i = 0; i < mutation.addedNodes.length; i++) {
          var addedNode = mutation.addedNodes[i];
          if (addedNode.dataset && addedNode.dataset.pjax != null) {
            callback();
            return true;
          }
        }
        return false;
      });
    });
    observer.observe(pjaxContainer, {childList: true});
  }
}

function getSessions(currentUser, path) {
  return getConfig().then(function(config) {
    var query = new Parse.Query(Session);
    query.notEqualTo('user', currentUser);
    query.equalTo('path', path);
    query.greaterThan(
      'updatedAt',
      new Date(Date.now() - config.sessionTimeout)
    );
    return query.find().then(function(sessions) {
      var userMap = {};
      sessions.forEach(function(session) {
        userMap[session.get('user')] = {
          name: session.get('user')
        };
      });
      return userMap;
    });
  });
}

function renderSessions(sessions) {
  var discussion = document.querySelector('.js-discussion');
  if (!discussion) {
    console.error('Unable to find `#js-discussion`.');
    return;
  }

  var sessionContainerID = 'gh-presence-container';
  var sessionContainer = document.getElementById(sessionContainerID);
  if (!sessionContainer) {
    // <div class="discussion-item js-details-container">
    //   <div class="discussion-item-header">
    //     <span class="octicon octicon-eye discussion-item-icon"></span>
    //     <a href="/username" class="author">username</a>
    //     {', '}
    //     ...
    //   </div>
    // </div>
    sessionContainer = document.createElement('div');
    sessionContainer.className = 'discussion-item js-details-container';
    sessionContainer.id = sessionContainerID;

    var sessionHeader = document.createElement('div');
    sessionHeader.className = 'discussion-item-header';

    sessionContainer.appendChild(sessionHeader);
  }

  var sessionHeader = sessionContainer.firstChild;
  var sessionHeaderChild;
  while (sessionHeaderChild = sessionHeader.firstChild) {
    sessionHeader.removeChild(sessionHeaderChild);
  }

  var users = Object.keys(sessions);
  if (users.length) {
    var sessionIcon = document.createElement('span');
    sessionIcon.className = 'octicon octicon-eye discussion-item-icon';
    sessionHeader.appendChild(sessionIcon);

    users.forEach(function(user, ii) {
      var sessionUser = document.createElement('a');
      sessionUser.className = 'author';
      sessionUser.href = '/' + user;
      sessionUser.appendChild(document.createTextNode(user));

      if (ii > 0) {
        if (ii < users.length - 1) {
          sessionHeader.appendChild(document.createTextNode(', '));
        } else {
          sessionHeader.appendChild(document.createTextNode(' and '));
        }
      }
      sessionHeader.appendChild(sessionUser);
    });
    var verb = users.length === 1 ? 'is' : 'are';
    sessionHeader.appendChild(
      document.createTextNode(' ' + verb + ' looking at this')
    );
    var closedBanner = discussion.querySelector('.closed-banner');
    if (closedBanner) {
      closedBanner.parentNode.insertBefore(sessionContainer, closedBanner);
    } else {
      discussion.appendChild(sessionContainer);
    }
  } else {
    if (sessionContainer.parentNode) {
      sessionContainer.parentNode.removeChild(sessionContainer);
    }
  }
}

function main() {
  var user = getUser();
  if (!user) {
    return;
  }
  var session = new Session();
  var initialPath = getPath();

  // Keep Parse up-to-date with the current path.

  session.save({user: user, path: initialPath});

  addNavigationListener(function() {
    session.save({user: user, path: getPath()});
  });

  window.addEventListener('beforeunload', function() {
    session.save({user: user, path: null});
  }, false);

  getConfig().then(function(config) {
    setInterval(function() {
      var path = getPath();
      if (path) {
        session.save({user: user, path: path});
      }
    }, config.sessionTimeout - config.networkLatency);
  });

  // Display a list of users on the current path.

  if (initialPath) {
    getSessions(user, initialPath).then(renderSessions);
  }

  getConfig().then(function(config) {
    setInterval(function() {
      var path = getPath();
      if (path) {
        getSessions(user, path).then(renderSessions);
      }
    }, config.updateInterval);
  });
}

main();
