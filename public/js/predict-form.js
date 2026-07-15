/**
 * Client-side UX helpers for the prediction form.
 * This is convenience only — public/../src/validators/prediction.validator.js
 * on the server is the validation that actually matters.
 */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('predictionForm');
  if (!form) {
    return;
  }

  // ---------------------------------------------------------
  // Exam selection — switching between MCA CET / MBA CET (etc)
  // updates the hidden examTypeCode field, the percentile field's
  // label, and re-fetches the Dream College list for that exam
  // (colleges are exam-specific; categories and universities are
  // not, so those dropdowns don't need to change).
  // ---------------------------------------------------------
  const examButtons = document.querySelectorAll('.exam-type-btn');
  const examTypeCodeInput = document.getElementById('examTypeCode');
  const percentileLabelText = document.getElementById('percentileLabelText');
  const dreamCollegeSelect = document.getElementById('dreamCollegeId');
  const dreamCollegeHint = document.getElementById('dreamCollegeHint');
  const collegesApiUrl = form.dataset.collegesApi;

  async function refreshCollegesForExam(examCode) {
    if (!dreamCollegeSelect || !collegesApiUrl) {
      return;
    }
    dreamCollegeHint.textContent = 'Loading colleges…';

    try {
      const response = await fetch(`${collegesApiUrl}?exam=${encodeURIComponent(examCode)}`);
      if (!response.ok) {
        throw new Error('Request failed');
      }
      const data = await response.json();

      // Rebuild the options, keeping the "no dream college" default.
      dreamCollegeSelect.innerHTML = '';
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'No dream college / not sure yet';
      defaultOption.selected = true;
      dreamCollegeSelect.appendChild(defaultOption);

      data.colleges.forEach((college) => {
        const option = document.createElement('option');
        option.value = college.id;
        option.textContent = college.name;
        dreamCollegeSelect.appendChild(option);
      });

      dreamCollegeHint.textContent =
        data.colleges.length === 0 ? 'College list will be available once official cutoff data is loaded.' : '';
    } catch (err) {
      dreamCollegeHint.textContent = 'Could not load colleges right now — you can still submit without a dream college.';
    }
  }

  examButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const code = button.dataset.examCode;
      const name = button.dataset.examName;

      // Update card styles: selected card gets the highlighted
      // treatment, rest return to their default unselected look.
      examButtons.forEach((btn) => {
        btn.classList.remove('vn-exam-card-selected');
      });
      button.classList.add('vn-exam-card-selected');

      if (examTypeCodeInput) {
        examTypeCodeInput.value = code;
      }
      if (percentileLabelText) {
        percentileLabelText.textContent = name;
      }

      // Switching exams invalidates any previously selected dream
      // college (it belonged to the other exam's college list).
      refreshCollegesForExam(code);
    });
  });

  // Mobile: digits only, max 10.
  const mobileInput = document.getElementById('mobile');
  if (mobileInput) {
    mobileInput.addEventListener('input', () => {
      mobileInput.value = mobileInput.value.replace(/\D/g, '').slice(0, 10);
    });
  }

  // Percentile: digits and a single decimal point only.
  const percentileInput = document.getElementById('percentile');
  if (percentileInput) {
    percentileInput.addEventListener('input', () => {
      let value = percentileInput.value.replace(/[^\d.]/g, '');
      const firstDot = value.indexOf('.');
      if (firstDot !== -1) {
        value = value.slice(0, firstDot + 1) + value.slice(firstDot + 1).replace(/\./g, '');
      }
      percentileInput.value = value;
    });
  }

  // Bootstrap's standard client-side validation trigger.
  // The actual submission still goes to the server either way —
  // this only blocks obviously-empty required fields early.
  form.addEventListener(
    'submit',
    (event) => {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
        form.classList.add('was-validated');
        return;
      }
      form.classList.add('was-validated');

      // Show a premium loading state on the submit button while
      // the server computes the actual prediction (a real, if
      // brief, wait — not instant). The form still submits
      // normally right after this; the button never needs to be
      // reverted afterward, since a full page navigation follows
      // regardless of success or a server-side validation error.
      const submitBtn = document.getElementById('predictionSubmitBtn');
      const submitLabel = document.getElementById('predictionSubmitLabel');
      const submitIcon = document.getElementById('predictionSubmitIcon');
      if (submitBtn && submitLabel) {
        submitBtn.disabled = true;
        submitBtn.classList.add('vn-btn-loading');
        submitLabel.innerHTML = '<span class="vn-spinner" aria-hidden="true"></span> Calculating your prediction&hellip;';
        if (submitIcon) {
          submitIcon.style.display = 'none';
        }
      }
    },
    false
  );
});