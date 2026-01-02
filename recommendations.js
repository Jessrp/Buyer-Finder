// recommendations.js — Buyer-Finder

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('recommendationsContainer');

  async function loadRecommendations() {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .limit(6)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    container.innerHTML = '';
    data.forEach(p => {
      const card = document.createElement('div');
      card.className = 'recommendationCard';
      card.innerHTML = `
        <h4>${p.title}</h4>
        <p>${p.description}</p>
        <small>Price: $${p.price || 'N/A'}</small>
      `;
      container.appendChild(card);
    });
  }

  loadRecommendations();
});