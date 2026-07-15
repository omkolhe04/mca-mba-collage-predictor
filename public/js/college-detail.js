/**
 * Filters the category-wise CAP cutoff table(s) by the selected
 * category. Pure client-side toggle — no extra request, since
 * the full table for the latest year is already rendered.
 */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const filter = document.getElementById('categoryFilter');
  if (!filter) {
    return;
  }

  const rows = document.querySelectorAll('.cutoff-table tbody tr[data-category-id]');

  filter.addEventListener('change', () => {
    const selected = filter.value;
    rows.forEach((row) => {
      const matches = selected === 'all' || row.getAttribute('data-category-id') === selected;
      row.style.display = matches ? '' : 'none';
    });
  });
});
