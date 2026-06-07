import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const useAuthStore = create((set, get) => ({
  user: null,
  isLoggedIn: false,

  init: () => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) get()._handleAuthUser(session.user)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        get()._handleAuthUser(session.user)
      } else if (event === 'SIGNED_OUT') {
        set({ user: null, isLoggedIn: false })
      }
    })

    return () => subscription.unsubscribe()
  },

  _handleAuthUser: async (authUser) => {
    const { data } = await supabase
      .from('users')
      .select()
      .eq('email', authUser.email)
      .maybeSingle()

    if (data) {
      set({
        user: { id: data.id, email: data.email, firstName: data.first_name, lastName: data.last_name, isAnonymous: data.is_anonymous },
        isLoggedIn: true,
      })
    } else {
      const { data: newUser } = await supabase
        .from('users')
        .insert({ email: authUser.email, first_name: '', last_name: '', is_anonymous: false })
        .select()
        .single()
      if (newUser) {
        set({
          user: { id: newUser.id, email: newUser.email, firstName: '', lastName: '', isAnonymous: false },
          isLoggedIn: true,
        })
      }
    }
  },

  sendMagicLink: async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'https://voicesworldcup.vercel.app' },
    })
    if (error) throw error
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null, isLoggedIn: false })
  },
}))

export default useAuthStore
