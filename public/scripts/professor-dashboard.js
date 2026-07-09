document.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('notificationsPanel');
  if (!panel) return;

  panel.addEventListener('click', async (e) => {
    const dismissBtn = e.target.closest('.dismiss-notification-btn');
    if (!dismissBtn) return;

    const alertBox = dismissBtn.closest('.notification-alert');
    if (!alertBox) return;

    const id = alertBox.getAttribute('data-id');

    try {
      const response = await fetch(`/professor/notifications/${id}/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const result = await response.json();
      if (result.success) {
        alertBox.remove();
        if (panel.querySelectorAll('.notification-alert').length === 0) {
          panel.remove();
        }
      }
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  });
});
