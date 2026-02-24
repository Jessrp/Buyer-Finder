// report.js — Buyer-Finder

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('reportModal');
  const closeBtn = document.getElementById('modalCloseBtn');
  const reportForm = document.getElementById('reportForm');

  document.body.addEventListener('click', e => {
    if (e.target.classList.contains('report-btn')) {
      modal.style.display = 'block';
      reportForm.dataset.postId = e.target.dataset.postId;
    }
  });

  closeBtn.onclick = () => {
    modal.style.display = 'none';
    reportForm.reset();
  };

  reportForm.addEventListener('submit', async e => {
    e.preventDefault();

    const report = {
      post_id: reportForm.dataset.postId,
      reason: document.getElementById('reportReason').value.trim()
    };

    const { error } = await supabase.from('reports').insert([report]);
    if (error) {
      alert('Report failed');
      return;
    }

    alert('Report submitted');
    modal.style.display = 'none';
    reportForm.reset();
  });
});