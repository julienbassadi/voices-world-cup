import { create } from 'zustand'

const useAuthStore = create((set) => ({
  user: null,
  isLoggedIn: false,
  login:  (user) => set({ user, isLoggedIn: true }),
  logout: ()     => set({ user: null, isLoggedIn: false }),
}))

export default useAuthStore
