document.addEventListener('DOMContentLoaded', () => {
  const statusFilter = document.getElementById('statusFilter');
  const dateSort = document.getElementById('dateSort');
  const table = document.getElementById('assignmentsTable');
  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('.assignment-row'));
  const emptyRow = document.getElementById('emptyRow');

  const detailModal = document.getElementById('detailModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalId = document.getElementById('modalId');
  const modalTitle = document.getElementById('modalTitle');
  const modalCategory = document.getElementById('modalCategory');
  const modalStatusBadge = document.getElementById('modalStatusBadge');
  const modalDate = document.getElementById('modalDate');
  const modalReviewer = document.getElementById('modalReviewer');
  const modalDescription = document.getElementById('modalDescription');
  const modalFileLink = document.getElementById('modalFileLink');

  const modalSubmitSection = document.getElementById('modalSubmitSection');
  const modalSubmitForm = document.getElementById('modalSubmitForm');
  const modalReviewerSelect = document.getElementById('modalReviewerSelect');

  const updateTable = () => {
    const filterValue = statusFilter.value;
    const sortValue = dateSort.value;

    let visibleCount = 0;
    rows.forEach(row => {
      const status = row.getAttribute('data-status');
      if (filterValue === 'All' || status === filterValue) {
        row.style.display = '';
        visibleCount++;
      } else {
        row.style.display = 'none';
      }
    });

    if (visibleCount === 0) {
      if (emptyRow) {
        emptyRow.style.display = '';
      } else {
        const tr = document.createElement('tr');
        tr.id = 'emptyRow';
        tr.innerHTML = `<td colspan="5" style="text-align: center; color: var(--text-muted); padding: 32px;">No assignments found.</td>`;
        tbody.appendChild(tr);
      }
    } else {
      const existingEmpty = document.getElementById('emptyRow');
      if (existingEmpty) {
        existingEmpty.style.display = 'none';
      }
    }

    const sortedRows = rows.slice().sort((a, b) => {
      const dateA = new Date(a.getAttribute('data-rawdate'));
      const dateB = new Date(b.getAttribute('data-rawdate'));
      return sortValue === 'asc' ? dateA - dateB : dateB - dateA;
    });

    sortedRows.forEach(row => {
      if (row.parentNode === tbody) {
        tbody.appendChild(row);
      }
    });
  };

  statusFilter.addEventListener('change', updateTable);
  dateSort.addEventListener('change', updateTable);

  tbody.addEventListener('click', (e) => {
    const row = e.target.closest('.assignment-row');
    if (!row) return;

    const id = row.getAttribute('data-id');
    window.location.href = `/student/assignments/${id}`;
  });

  updateTable();
});
