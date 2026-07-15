/**
 * VidyaNITI — Premium UI behaviors.
 *
 * Every effect here is opt-in via a class or data-attribute on
 * the markup — later phases never need to write new JS, just
 * add e.g. class="vn-reveal" or data-count-to="500" to an
 * element and it's automatically animated. Loaded once, globally,
 * on the public site layout only (not the admin panel).
 *
 * Deliberately dependency-free: Intersection Observer and CSS
 * transforms only, per the brief's own performance requirement.
 */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  initScrollReveal();
  initCountUp();
  initMagneticButtons();
  initRippleButtons();
  initStickyNavbar();
  initStepCycle();

  // ---------------------------------------------------------
  // Step cycle — for any container marked data-step-cycle,
  // automatically advances through its direct .vn-step-row
  // children, marking the current one .vn-step-active and prior
  // ones .vn-step-done, looping back to the start after a pause.
  // Built generically (not hero-specific) so any future "watch
  // it work" checklist animation reuses this with zero new JS —
  // just markup. Paused entirely under reduced-motion (jumps to
  // showing all steps as done, a static end-state).
  // ---------------------------------------------------------
  function initStepCycle() {
    const containers = document.querySelectorAll('[data-step-cycle]');
    if (containers.length === 0) return;

    containers.forEach((container) => {
      const steps = Array.from(container.querySelectorAll('.vn-step-row'));
      if (steps.length === 0) return;

      if (prefersReducedMotion) {
        steps.forEach((step) => step.classList.add('vn-step-done'));
        return;
      }

      const interval = parseInt(container.dataset.stepInterval, 10) || 1600;
      const pauseAtEnd = parseInt(container.dataset.stepEndPause, 10) || 2200;
      let current = -1;

      function advance() {
        steps.forEach((step) => step.classList.remove('vn-step-active'));
        current += 1;

        if (current >= steps.length) {
          // Brief pause showing every step completed, then reset
          // and start the cycle over — a continuous "demo loop".
          setTimeout(() => {
            steps.forEach((step) => step.classList.remove('vn-step-done', 'vn-step-active'));
            current = -1;
            advance();
          }, pauseAtEnd);
          return;
        }

        steps[current].classList.add('vn-step-active');
        for (let i = 0; i < current; i += 1) {
          steps[i].classList.add('vn-step-done');
        }

        setTimeout(advance, interval);
      }

      advance();
    });
  }

  // ---------------------------------------------------------
  // Scroll reveal — fades/slides elements in as they enter the
  // viewport. Skips straight to the revealed state if the user
  // has asked for reduced motion, or if IntersectionObserver
  // isn't available for some reason (very old browser) — the
  // content should never be stuck invisible.
  // ---------------------------------------------------------
  function initScrollReveal() {
    const elements = document.querySelectorAll('.vn-reveal, .vn-reveal-scale');
    if (elements.length === 0) return;

    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
      elements.forEach((el) => el.classList.add('vn-revealed'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('vn-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    elements.forEach((el) => observer.observe(el));
  }

  // ---------------------------------------------------------
  // Count-up — animates a number from 0 to data-count-to when
  // it scrolls into view. Optional data-count-suffix ("+", "%")
  // and data-count-duration (ms, default 1800).
  // ---------------------------------------------------------
  function initCountUp() {
    const elements = document.querySelectorAll('[data-count-to]');
    if (elements.length === 0) return;

    const animateElement = (el) => {
      const target = parseFloat(el.dataset.countTo);
      if (Number.isNaN(target)) return;
      const suffix = el.dataset.countSuffix || '';
      const duration = parseInt(el.dataset.countDuration, 10) || 1800;
      const startTime = performance.now();

      function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out cubic — starts fast, settles smoothly, feels
        // more premium than a flat linear count.
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(eased * target);
        el.textContent = current.toLocaleString('en-IN') + suffix;

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          el.textContent = target.toLocaleString('en-IN') + suffix;
        }
      }

      requestAnimationFrame(tick);
    };

    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
      elements.forEach((el) => {
        const target = parseFloat(el.dataset.countTo);
        const suffix = el.dataset.countSuffix || '';
        if (!Number.isNaN(target)) el.textContent = target.toLocaleString('en-IN') + suffix;
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateElement(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );

    elements.forEach((el) => observer.observe(el));
  }

  // ---------------------------------------------------------
  // Magnetic buttons — the button subtly follows the cursor
  // within a small radius, springing back on mouse leave. Only
  // on devices with a precise pointer (mouse) — skipped on
  // touch, where it has no meaning, and skipped entirely under
  // reduced-motion.
  // ---------------------------------------------------------
  function initMagneticButtons() {
    if (prefersReducedMotion || !window.matchMedia('(pointer: fine)').matches) return;

    const buttons = document.querySelectorAll('.vn-magnetic');
    const strength = 0.25;
    const maxOffset = 10;

    buttons.forEach((button) => {
      button.addEventListener('mousemove', (event) => {
        const rect = button.getBoundingClientRect();
        const relX = event.clientX - (rect.left + rect.width / 2);
        const relY = event.clientY - (rect.top + rect.height / 2);
        const offsetX = Math.max(-maxOffset, Math.min(maxOffset, relX * strength));
        const offsetY = Math.max(-maxOffset, Math.min(maxOffset, relY * strength));
        button.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      });

      button.addEventListener('mouseleave', () => {
        button.style.transform = '';
      });
    });
  }

  // ---------------------------------------------------------
  // Ripple — expanding circle from the click point. Container
  // needs class="vn-ripple-container" (position:relative +
  // overflow:hidden, defined in premium.css); this just inserts
  // and cleans up the animated span.
  // ---------------------------------------------------------
  function initRippleButtons() {
    const containers = document.querySelectorAll('.vn-ripple-container');

    containers.forEach((container) => {
      container.addEventListener('click', (event) => {
        const rect = container.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const ripple = document.createElement('span');
        ripple.className = 'vn-ripple';
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
        ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
        container.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());
      });
    });
  }

  // ---------------------------------------------------------
  // Sticky navbar shrink — toggles .vn-navbar-scrolled once the
  // page has scrolled past a small threshold. Passive listener
  // for scroll performance.
  // ---------------------------------------------------------
  function initStickyNavbar() {
    const navbar = document.querySelector('.vn-navbar');
    if (!navbar) return;

    const threshold = 24;
    const updateState = () => {
      navbar.classList.toggle('vn-navbar-scrolled', window.scrollY > threshold);
    };

    updateState();
    window.addEventListener('scroll', updateState, { passive: true });
  }
});
