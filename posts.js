const postsGrid = document.getElementById('postsGrid');

async function loadPosts() {
  const { data } = await supabaseClient.from('posts').select('*');
  postsGrid.innerHTML = '';
  data?.forEach(p => {
    const div = document.createElement('div');
    div.className = 'postCard';
    div.innerHTML = `<h4>${p.title}</h4><p>${p.description}</p>`;
    postsGrid.appendChild(div);
  });
}