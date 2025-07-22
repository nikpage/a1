// path: /pages/auth/callback.js
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

export async function getServerSideProps({ req }) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  const { data: { user }, error } = await supabase.auth.getUser(req.headers.cookie)
  if (error || !user) return { redirect: { destination: '/', permanent: false } }

  // Check if user exists by auth_id
  const { data: existingUser } = await supabase
    .from('users')
    .select('user_id')
    .eq('auth_id', user.id)
    .maybeSingle()

  // If not, create new user with new user_id
  let user_id = existingUser?.user_id
  if (!user_id) {
    user_id = uuidv4()
    await supabase.from('users').insert({
      user_id,
      auth_id: user.id,
      email: user.email,
      created_at: new Date()
    })
  }

  // Redirect to the user_id URL
  return { redirect: { destination: `/${user_id}`, permanent: false } }
}

export default function Callback() {
  return null
}
