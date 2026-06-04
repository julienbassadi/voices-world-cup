import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const useAuthStore = create((set) => ({
  user: null,
  isLoggedIn: false,

  createAccount: async (email, firstName, lastName, isAnonymous) => {
    const { data, error } = await supabase
      .from('users')
      .insert({ email, first_name: firstName, last_name: lastName, is_anonymous: isAnonymous })
      .select()
      .single()
    if (error) {
      console.error('[authStore.createAccount] Supabase error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      throw error
    }
    set({
      user: { id: data.id, email: data.email, firstName: data.first_name, lastName: data.last_name, isAnonymous: data.is_anonymous },
      isLoggedIn: true,
    })
  },

  login: async (email) => {
    const { data, error } = await supabase
      .from('users')
      .select()
      .eq('email', email)
      .single()
    if (error) throw error
    set({
      user: { id: data.id, email: data.email, firstName: data.first_name, lastName: data.last_name, isAnonymous: data.is_anonymous },
      isLoggedIn: true,
    })
  },

  logout: () => set({ user: null, isLoggedIn: false }),
}))

export default useAuthStore
