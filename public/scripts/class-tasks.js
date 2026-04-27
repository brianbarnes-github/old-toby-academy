/* Old Toby Academy — class-tasks.js
 *
 * Hydrates GFM task list checkboxes inside `.class-body` with persistent
 * per-user state. Reads initial state from a `<script id="task-state">`
 * JSON blob (server-rendered), and POSTs every change to /api/progress/task.
 *
 * Loaded only when a class body actually contains tasks.
 */
(function () {
  'use strict';

  function init() {
    var body = document.querySelector('.class-body');
    if (!body) return;

    var classId = body.getAttribute('data-class-id');
    var courseSlug = body.getAttribute('data-course-slug');
    if (!classId || !courseSlug) return;

    var csrfToken = '';
    var meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) csrfToken = meta.getAttribute('content') || '';

    var state = {};
    var stateNode = document.getElementById('task-state');
    if (stateNode && stateNode.textContent) {
      try {
        state = JSON.parse(stateNode.textContent);
      } catch (e) {
        state = {};
      }
    }

    var checkboxes = body.querySelectorAll('input[type="checkbox"][data-task-index]');
    Array.prototype.forEach.call(checkboxes, function (cb) {
      var index = cb.getAttribute('data-task-index');
      var key = 'task-' + index;
      if (state[key] === true) {
        cb.checked = true;
        markDone(cb, true);
      }
      cb.addEventListener('change', function () {
        onToggle(cb, key);
      });
    });

    function onToggle(cb, key) {
      var nextCompleted = cb.checked;
      markDone(cb, nextCompleted);
      var body = new URLSearchParams();
      body.set('csrf_token', csrfToken);
      body.set('course_slug', courseSlug);
      body.set('class_id', classId);
      body.set('task_key', key);
      body.set('completed', nextCompleted ? 'true' : 'false');

      fetch('/api/progress/task', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        credentials: 'same-origin',
      })
        .then(function (r) {
          if (r.status !== 204) throw new Error('save failed (' + r.status + ')');
          flashSaved(cb);
        })
        .catch(function () {
          // Revert on failure.
          cb.checked = !nextCompleted;
          markDone(cb, !nextCompleted);
          flashError(cb);
        });
    }

    function markDone(cb, done) {
      var li = cb.closest('li');
      if (!li) return;
      if (done) li.classList.add('is-done');
      else li.classList.remove('is-done');
    }

    function flashSaved(cb) {
      var li = cb.closest('li');
      if (!li) return;
      li.classList.add('is-saved');
      setTimeout(function () {
        li.classList.remove('is-saved');
      }, 800);
    }

    function flashError(cb) {
      var li = cb.closest('li');
      if (!li) return;
      li.classList.add('is-error');
      setTimeout(function () {
        li.classList.remove('is-error');
      }, 1600);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
