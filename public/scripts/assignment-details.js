document.addEventListener('DOMContentLoaded', () => {
  const detailsSubmitForm = document.getElementById('detailsSubmitForm');
  if (detailsSubmitForm) {
    detailsSubmitForm.addEventListener('submit', (e) => {
      const confirmSubmit = confirm('Are you sure you want to submit this assignment for review? Once submitted, it cannot be modified.');
      if (!confirmSubmit) {
        e.preventDefault();
      }
    });
  }
  const resubmitForm = document.getElementById('resubmitForm');
  if (resubmitForm) {
    resubmitForm.addEventListener('submit', (e) => {
      const confirmSubmit = confirm('Are you sure you want to resubmit this assignment?');
      if (!confirmSubmit) {
        e.preventDefault();
      }
    });
  }
});
