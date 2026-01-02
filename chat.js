const chatContainer = document.getElementById('chatContainer');

document.getElementById('chatForm').onsubmit = async e => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if (!msg) return;

  await supabaseClient.from('messages').insert({ content: msg });
  chatInput.value = '';
  loadChat();
};

async function loadChat() {
  const { data } = await supabaseClient.from('messages').select('*').order('created_at');
  chatContainer.innerHTML = '';
  data?.forEach(m => {
    const p = document.createElement('p');
    p.textContent = m.content;
    chatContainer.appendChild(p);
  });
}

loadChat();