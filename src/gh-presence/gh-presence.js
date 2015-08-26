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
  var avatar = document.querySelector('.user-nav .avatar');
  if (avatar) {
    var name = avatar.alt.substr(1); // @username
    var fragment = window.location.hash.substr(1);
    if (fragment[0] === '@') {
      // For testing purposes.
      name = fragment.substr(1);
    }
    return {
      name: name,
      avatar: avatar.src
    };
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

function getCommentField() {
  return document.getElementById('new_comment_field');
}

function isTyping() {
  var commentField = getCommentField();
  return commentField ? commentField.value.trim().length > 0 : false;
}

function debounce(callback, delay) {
  var timeout;
  return function() {
    clearTimeout(timeout);
    var args = arguments;
    var context = this;
    timeout = setTimeout(function() {
      callback.apply(context, args);
    }, delay);
  };
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
    query.notEqualTo('user', currentUser.name);
    query.equalTo('path', path);
    query.greaterThan(
      'updatedAt',
      new Date(Date.now() - config.sessionTimeout)
    );
    return query.find().then(function(sessions) {
      var sessionsByUser = {};
      sessions.forEach(function(session) {
        sessionsByUser[session.get('user')] = {
          user: session.get('user'),
          avatar: session.get('avatar'),
          isTyping: session.get('isTyping')
        };
      });
      return Object.keys(sessionsByUser).map(function(user) {
        return sessionsByUser[user];
      });
    });
  });
}

/**
 * <div class="discussion-item js-details-container">
 *   <div class="discussion-item-header">
 *     <span class="octicon octicon-eye discussion-item-icon"></span>
 *     <img alt="..." class="avatar" height="16" src="..." width="16">
 *     <a href="/username" class="author">username</a>
 *     {', '}
 *     ...
 *   </div>
 * </div>
 */
function renderContainer(sessions, containerConfig) {
  var discussion = document.querySelector('.js-discussion');
  if (!discussion) {
    console.error('Unable to find `#js-discussion`.');
    return;
  }

  var container = document.getElementById(containerConfig.id);
  if (!container) {
    container = document.createElement('div');
    container.className = 'discussion-item js-details-container';
    container.id = containerConfig.id;

    var sessionHeader = document.createElement('div');
    sessionHeader.className = 'discussion-item-header';

    container.appendChild(sessionHeader);
  }

  var sessionHeader = container.firstChild;
  var sessionHeaderChild;
  while (sessionHeaderChild = sessionHeader.firstChild) {
    sessionHeader.removeChild(sessionHeaderChild);
  }

  if (sessions.length) {
    var sessionIcon = document.createElement('span');
    sessionIcon.className =
      // Yes, string concatenation; go ahead and puke.
      'octicon octicon-' + containerConfig.icon + ' discussion-item-icon';
    if (containerConfig.iconStyle) {
      Object.keys(containerConfig.iconStyle).forEach(function(styleName) {
        sessionIcon.style[styleName] = containerConfig.iconStyle[styleName];
      });
    }
    sessionHeader.appendChild(sessionIcon);

    sessions.forEach(function(session, ii) {
      if (ii > 0) {
        if (ii < sessions.length - 1) {
          sessionHeader.appendChild(document.createTextNode(', '));
        } else {
          sessionHeader.appendChild(document.createTextNode(' and '));
        }
      }
      sessionHeader.appendChild(renderSession(session));
    });
    sessionHeader.appendChild(
      document.createTextNode(containerConfig.getMessage(sessions))
    );
    var closedBanner = discussion.querySelector('.closed-banner');
    if (closedBanner) {
      closedBanner.parentNode.insertBefore(container, closedBanner);
    } else {
      var partialMarker = discussion.querySelector('#partial-timeline-marker');
      if (partialMarker) {
        partialMarker.parentNode.insertBefore(container, partialMarker);
      } else {
        discussion.appendChild(container);
      }
    }
  } else {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

function renderSession(session) {
  var fragment = document.createDocumentFragment();

  var sessionUserIcon;
  if (session.avatar) {
    sessionUserIcon = document.createElement('img');
    sessionUserIcon.className = 'avatar';
    sessionUserIcon.alt = '@' + session.user;
    sessionUserIcon.height = 16;
    sessionUserIcon.width = 16;
    sessionUserIcon.src = session.avatar;
    sessionUserIcon.style.cssFloat = 'none';
    sessionUserIcon.style.marginTop = '-1px';
    fragment.appendChild(sessionUserIcon);
  }

  var sessionUser = document.createElement('a');
  sessionUser.className = 'author';
  sessionUser.href = '/' + session.user;
  sessionUser.appendChild(document.createTextNode(session.user));
  fragment.appendChild(sessionUser);

  return fragment;
}

function renderSessions(sessions) {
  var reading = [];
  var writing = [];
  sessions.forEach(function(session) {
    if (session.isTyping) {
      writing.push(session);
    } else {
      reading.push(session);
    }
  });

  renderContainer(reading, {
    id: 'gh-presence-reading',
    icon: 'eye',
    getMessage: function(sessions) {
      return sessions.length === 1 ?
        ' is reading this' :
        ' are reading this';
    }
  });
  renderContainer(writing, {
    id: 'gh-presence-writing',
    icon: 'pencil',
    iconStyle: {
      color: '#fff',
      backgroundColor: '#cea61b',
      paddingLeft: '2px'
    },
    getMessage: function(sessions) {
      return sessions.length === 1 ?
        ' is typing a comment' :
        ' are typing comments';
    }
  });
}

function main() {
  var user = getUser();
  if (!user) {
    return;
  }
  var session = new Session();
  var sessionSave = function(path) {
    session.save({
      user: user.name,
      avatar: user.avatar,
      isTyping: isTyping(),
      path: path
    });
  };
  var initialPath = getPath();

  // Keep Parse up-to-date with the current path.

  sessionSave(initialPath);

  addNavigationListener(function() {
    sessionSave(getPath());
  });

  window.addEventListener('beforeunload', function() {
    sessionSave(null);
  }, false);

  getConfig().then(function(config) {
    setInterval(function() {
      var path = getPath();
      if (path) {
        sessionSave(path);
      }
    }, config.sessionTimeout - config.networkLatency);
  });

  // Keep Parse up-to-date with typing status.

  document.body.addEventListener(
    'input',
    debounce(function(event) {
      var path = getPath();
      if (path && event.target === getCommentField()) {
        sessionSave(path);
      }
    }, 2500),
    false
  );

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
