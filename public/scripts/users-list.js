const searchInput = document.getElementById('search-input');
const roleFilter = document.getElementById('role-filter');
const deptFilter = document.getElementById('dept-filter');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const pageInfo = document.getElementById('page-info');
const tableRows = Array.from(document.querySelectorAll('.user-row'));
const noResultsRow = document.getElementById('no-results-row');
const emptyRow = document.getElementById('empty-row');

let currentPage = 1;
const limit = 20;
let visibleRows = [...tableRows];

function filterAndPaginate() {
  const query = searchInput.value.toLowerCase().trim();
  const selectedRole = roleFilter.value.toLowerCase();
  const selectedDept = deptFilter.value;

  visibleRows = tableRows.filter(row => {
    const name = row.dataset.name.toLowerCase();
    const email = row.dataset.email.toLowerCase();
    const role = row.dataset.role.toLowerCase();
    const deptId = row.dataset.deptId;

    const matchesSearch = name.includes(query) || email.includes(query);
    const matchesRole = selectedRole === 'all' || role === selectedRole;
    const matchesDept = selectedDept === 'all' || deptId === selectedDept;

    return matchesSearch && matchesRole && matchesDept;
  });

  tableRows.forEach(row => row.style.display = 'none');

  const totalItems = visibleRows.length;
  const totalPages = Math.ceil(totalItems / limit) || 1;

  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

  if (totalItems === 0) {
    if (!emptyRow) {
      noResultsRow.style.display = '';
    }
    pageInfo.textContent = 'Page 1 of 1';
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  noResultsRow.style.display = 'none';

  const start = (currentPage - 1) * limit;
  const end = Math.min(start + limit, totalItems);

  for (let i = start; i < end; i++) {
    visibleRows[i].style.display = '';
  }

  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

if (tableRows.length > 0) {
  searchInput.addEventListener('input', () => {
    currentPage = 1;
    filterAndPaginate();
  });

  roleFilter.addEventListener('change', () => {
    currentPage = 1;
    filterAndPaginate();
  });

  deptFilter.addEventListener('change', () => {
    currentPage = 1;
    filterAndPaginate();
  });

  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      filterAndPaginate();
    }
  });

  nextBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(visibleRows.length / limit) || 1;
    if (currentPage < totalPages) {
      currentPage++;
      filterAndPaginate();
    }
  });

  filterAndPaginate();
}
