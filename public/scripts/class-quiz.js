/* Old Toby Academy — class-quiz.js
 *
 * Handles in-class quiz submission. Each question is a <form class="quiz-q">
 * with radio inputs for the options and a hidden explanation panel. On
 * submit we POST to /api/progress/quiz-answer, get back {correct,
 * correct_option_id}, mark the chosen option ✓ or ✗, highlight the
 * correct one, reveal the explanation, and let the student retry.
 *
 * Initial state is hydrated from a `<script id="quiz-state">` JSON blob
 * keyed by question_id → {option_id, correct}.
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
    var stateNode = document.getElementById('quiz-state');
    if (stateNode && stateNode.textContent) {
      try {
        state = JSON.parse(stateNode.textContent);
      } catch (e) {
        state = {};
      }
    }

    var forms = body.querySelectorAll('form.quiz-q');
    Array.prototype.forEach.call(forms, function (form) {
      var questionId = form.getAttribute('data-question-id');
      if (!questionId) return;

      // Hydrate prior answer.
      var prior = state[questionId];
      if (prior && prior.option_id) {
        var radio = form.querySelector(
          'input[type="radio"][value="' + prior.option_id + '"]',
        );
        if (radio) {
          radio.checked = true;
          showResult(form, prior.correct === true, prior.option_id, null);
        }
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        clearResult(form);

        var picked = form.querySelector('input[type="radio"]:checked');
        if (!picked) {
          flashHint(form, 'Pick an option first.');
          return;
        }
        var optionId = picked.value;

        var body = new URLSearchParams();
        body.set('csrf_token', csrfToken);
        body.set('course_slug', courseSlug);
        body.set('class_id', classId);
        body.set('question_id', questionId);
        body.set('option_id', optionId);

        var submit = form.querySelector('button[type="submit"]');
        if (submit) submit.disabled = true;

        fetch('/api/progress/quiz-answer', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
          credentials: 'same-origin',
        })
          .then(function (r) {
            if (!r.ok) throw new Error('save failed (' + r.status + ')');
            return r.json();
          })
          .then(function (data) {
            showResult(form, data.correct === true, optionId, data.correct_option_id || null);
          })
          .catch(function () {
            flashHint(form, 'Could not save answer. Try again.');
          })
          .then(function () {
            if (submit) submit.disabled = false;
          });
      });
    });

    function showResult(form, correct, pickedOptionId, correctOptionId) {
      form.classList.add('is-answered');
      form.classList.toggle('is-correct', correct);
      form.classList.toggle('is-incorrect', !correct);

      // Mark the picked option.
      var pickedLabel = form.querySelector(
        'input[type="radio"][value="' + pickedOptionId + '"]',
      );
      if (pickedLabel && pickedLabel.parentElement) {
        pickedLabel.parentElement.classList.add(correct ? 'opt-correct' : 'opt-wrong');
      }

      // Highlight the correct option (if we know it).
      if (correctOptionId) {
        var correctRadio = form.querySelector(
          'input[type="radio"][value="' + correctOptionId + '"]',
        );
        if (correctRadio && correctRadio.parentElement) {
          correctRadio.parentElement.classList.add('opt-correct');
        }
      }

      var expl = form.querySelector('.quiz-explanation');
      if (expl) expl.removeAttribute('hidden');
    }

    function clearResult(form) {
      form.classList.remove('is-answered', 'is-correct', 'is-incorrect');
      var labels = form.querySelectorAll('.opt-correct, .opt-wrong');
      Array.prototype.forEach.call(labels, function (l) {
        l.classList.remove('opt-correct', 'opt-wrong');
      });
      var expl = form.querySelector('.quiz-explanation');
      if (expl) expl.setAttribute('hidden', '');
      var hint = form.querySelector('.quiz-hint');
      if (hint) hint.remove();
    }

    function flashHint(form, msg) {
      var existing = form.querySelector('.quiz-hint');
      if (existing) existing.remove();
      var span = document.createElement('span');
      span.className = 'quiz-hint';
      span.textContent = msg;
      form.appendChild(span);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
