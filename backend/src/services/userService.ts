// userService.ts
import { supabase } from '../utils/supabaseClient'

export class UserService {
  // Sign in user
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  }

  // Sign out user (backend can clear cookies or tokens)
  async signOut(accessToken: string) {
    // Logic to remove token/session in backend or Supabase
    // Supabase JS might not provide direct signOut for server, just manage tokens
    // Or clear cookie/session here
  }
  
  async getUser(accessToken: string) {
    const { data, error } = await supabase.auth.getUser(accessToken)
    if (error) throw error
    return data.user
  }

  // Get multiple users by their auth UIDs (requires service role key)
  async getUsersByIds(ids: string[]) {
    const results: Array<{ id: string; email: string | null }> = []
    for (const id of ids) {
      try {
        const { data, error } = await supabase.auth.admin.getUserById(id)
        if (error) {
          console.warn('getUserById error for', id, error)
          results.push({ id, email: null })
        } else {
          results.push({ id, email: data?.user?.email ?? null })
        }
      } catch (e) {
        console.warn('Exception when fetching user by id', id, e)
        results.push({ id, email: null })
      }
    }
    return results
  }
}
