// ==UserScript==
// @name           GitHub: Mark as Read
// @version        0.1.0
// @description    Adds a "Mark as Read" toggle to PRs and Issues
// @match          https://github.com/*
// ==/UserScript==


function injectStyles(styles) {
  var style = document.createElement('style');
  style.innerHTML = styles;
  document.body.appendChild(style);
}

injectStyles(
  '.read-item a,' +
  '.read-item .issue-meta-section {' +
    'opacity: 0.2;' +
  '}' +
  '.read-item a.read-button,' +
  '.read-item .issue-meta-section a {' +
    'opacity: 1.0;' +
  '}' +
  '.read-button {' +
    'cursor: pointer;' +
  '}'
);

(function(global) {

  /* UTILITIES */

  function $(selector, start) {
    return (start || document).querySelector(selector);
  }

  function $$(selector, start) {
    return [].slice.call((start || document).querySelectorAll(selector));
  }

  var ScriptStorage = global.ScriptStorage = {
    subscribe: function(key, callback) {
      var handleStorageChange = function(event) {
        if (event.key === key) {
          callback(event);
        }
      };
      window.addEventListener('storage', handleStorageChange, false);
      return {
        unsubscribe: function() {
          if (handleStorageChange) {
            window.removeEventListener('storage', handleStorageChange, false);
            handleStorageChange = null;
          }
        }
      };
    },
    get: function(key) {
      var item;
      try {
        item = JSON.parse(localStorage.getItem(key));
      } catch (e) {}
      return item && typeof item === 'object' ? item : {};
    },
    set: function(key, item) {
      localStorage.setItem(key, JSON.stringify(item));
    }
  };

  /* INIT */

  /**
   * Update on Navigation
   */
  var pjaxContainer = $('#js-repo-pjax-container');
  if (pjaxContainer) {
    var observer = new MutationObserver(function(mutations) {
      mutations.some(function(mutation) {
        for (var i = 0; i < mutation.addedNodes.length; i++) {
          var addedNode = mutation.addedNodes[i];
          if (addedNode.dataset && addedNode.dataset.pjax != null) {
            flushStorageToView();
            return true;
          }
        }
        return false;
      });
    });
    observer.observe(pjaxContainer, {childList: true});
  }

  function flushStorageToView() {
    var readItems = ScriptStorage.get('github-read');

    /**
     * Issues List View
     */
    $$('.table-list-issues > .table-list-item').forEach(function(item) {
      var itemID;
      var checkbox = $('.select-toggle-check', item);
      if (checkbox) {
        itemID = checkbox.value;
      }
      var timeISO;
      var time = $('time', item);
      if (time) {
        timeISO = time.getAttribute('datetime');
      }
      var metaRow = $('.issue-meta', item);

      if (!itemID || !timeISO || !metaRow) {
        return;
      }
      var isRead = readItems[itemID] && readItems[itemID] === timeISO;

      var readButton = $('.read-button', item);
      if (!readButton) {
        readButton = document.createElement('a');
        readButton.className = 'read-button muted-link tooltipped tooltipped-n';

        var readIcon = document.createElement('span');
        readIcon.className = 'octicon octicon-eye';

        readButton.appendChild(readIcon);
        metaRow.insertBefore(readButton, metaRow.firstChild);

        readButton.addEventListener('click', function(event) {
          event.preventDefault();
          handleItemClick(itemID, timeISO);
        }, false);
      }

      if (isRead) {
        item.classList.add('read-item');
        readButton.setAttribute('aria-label', 'Mark as unread');
      } else {
        item.classList.remove('read-item');
        readButton.setAttribute('aria-label', 'Mark as read');
      }
    });
  }

  function handleItemClick(itemID, timeISO) {
    var readItems = ScriptStorage.get('github-read');
    if (readItems[itemID] && readItems[itemID] === timeISO) {
      delete readItems[itemID];
    } else {
      readItems[itemID] = timeISO;
    }
    ScriptStorage.set('github-read', readItems);
    flushStorageToView();
  }

  flushStorageToView();

  ScriptStorage.subscribe('github-read', flushStorageToView);

})(this);
