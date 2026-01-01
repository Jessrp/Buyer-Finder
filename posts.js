
import { supabase } from './auth.js'

export async function loadPosts() {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error(error)
    return []
  }
  return data
}

export async function createPost(title, price, description) {
  const user = (await supabase.auth.getUser()).data.user
  if (!user) throw new Error('Not logged in')

  const { error } = await supabase.from('posts').insert({
    title,
    price,
    description,
    user_id: user.id
  })

  if (error) throw error
}

export async function deletePost(id) {
  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) throw error
}

export async function updatePost(id, updates) {
  const { error } = await supabase.from('posts').update(updates).eq('id', id)
  if (error) throw error
}
