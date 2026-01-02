// reviews.js — Buyer-Finder

document.addEventListener('DOMContentLoaded', () => {
  const reviewsContainer = document.getElementById('reviewsContainer');
  const reviewForm = document.getElementById('reviewForm');

  async function loadReviews() {
    const reviewedUserId = reviewForm.dataset.reviewedUserId;

    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('reviewed_user_id', reviewedUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    reviewsContainer.innerHTML = '';
    data.forEach(r => {
      const div = document.createElement('div');
      div.className = 'review';
      div.innerHTML = `
        <strong>${r.reviewer_name}</strong>
        <span class="stars">${'★'.repeat(r.rating)}</span>
        <p>${r.comment}</p>
        <div class="timestamp">${new Date(r.created_at).toLocaleString()}</div>
      `;
      reviewsContainer.appendChild(div);
    });
  }

  reviewForm.addEventListener('submit', async e => {
    e.preventDefault();

    const review = {
      reviewer_name: document.getElementById('reviewerName').value.trim(),
      comment: document.getElementById('reviewComment').value.trim(),
      rating: parseInt(document.getElementById('reviewRating').value),
      reviewed_user_id: reviewForm.dataset.reviewedUserId
    };

    const { error } = await supabase.from('reviews').insert([review]);
    if (error) {
      alert('Review failed');
      return;
    }

    reviewForm.reset();
    loadReviews();
  });

  loadReviews();
});