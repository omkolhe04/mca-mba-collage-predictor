document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('userDetailOverlay');
  const drawer = document.getElementById('userDetailDrawer');
  const content = document.getElementById('userDetailContent');
  const closeBtn = document.getElementById('userDetailCloseBtn');

  function openDrawer() {
    if (!drawer || !overlay) return;
    drawer.classList.add('vn-drawer-open');
    overlay.classList.add('vn-drawer-overlay-visible');
    drawer.setAttribute('aria-hidden', 'false');
  }

  function closeDrawer() {
    if (!drawer || !overlay) return;
    drawer.classList.remove('vn-drawer-open');
    overlay.classList.remove('vn-drawer-overlay-visible');
    drawer.setAttribute('aria-hidden', 'true');
  }

  document.querySelectorAll('.vn-view-detail-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const detailUrl = btn.getAttribute('data-detail-url');
      openDrawer();
      content.innerHTML = '<p class="text-center small" style="color: var(--vn-ink-muted);">Loading&hellip;</p>';
      try {
        const response = await fetch(detailUrl);
        content.innerHTML = await response.text();
      } catch (err) {
        content.innerHTML = '<p class="text-center small" style="color: var(--vn-danger);">Could not load details. Please try again.</p>';
      }
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (overlay) overlay.addEventListener('click', closeDrawer);

  // Filter selects submit immediately on change, so the list
  // feels responsive without needing a separate "Apply" click —
  // only the free-text search and date fields wait for the
  // explicit Filter button, since submitting on every keystroke
  // or every partial date entry would be premature.
  const form = document.getElementById('userFiltersForm');
  if (form) {
    form.querySelectorAll('select[name]').forEach((select) => {
      select.addEventListener('change', () => form.submit());
    });
  }
});
