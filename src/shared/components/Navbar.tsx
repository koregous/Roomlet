'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState, useRef } from 'react'
import { getSupabaseBrowserClient } from '@/shared/lib/supabase-browser'
import { LogOut, Menu, X, User, FileText, ChevronDown, EyeOff, Eye, Heart, Rss, ExternalLink } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { useToast } from './Toast'
import { useNSFWPreferences } from '@/shared/lib/nsfw-preferences'

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const { addToast } = useToast()
  const { enabled: nsfwEnabled, enable, disable } = useNSFWPreferences()
  
  const toggleNSFW = () => {
    if (nsfwEnabled) {
      disable()
    } else {
      enable()
    }
  }

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    
    // Initial user check
    checkUser(supabase)
    
    // Listen to auth state changes (fixes: dashboard not appearing after login)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        checkUser(supabase)
      } else {
        setUser(null)
        setUsername(null)
        setIsAdmin(false)
        setIsLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDesktopMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const checkUser = async (supabase: ReturnType<typeof getSupabaseBrowserClient>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      // Check if user is admin and get username
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin, user_id, username')
          .eq('user_id', user.id)
          .single()

        // Only set admin to true if explicitly true, otherwise false
        setIsAdmin(profile?.is_admin === true)
        setUsername((profile?.username as string | undefined) ?? null)
      } else {
        setIsAdmin(false)
        setUsername(null)
      }
    } catch (err) {
      console.error('Failed to get user:', err)
      setIsAdmin(false)
      setUsername(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      const supabase = getSupabaseBrowserClient()
      await supabase.auth.signOut()
      setUser(null)
      setUsername(null)
      setMobileMenuOpen(false)
      setDesktopMenuOpen(false)
      addToast('Logged out successfully', 'success', 2000)
      router.push('/')
    } catch {
      console.error('Failed to logout')
      addToast('Failed to log out', 'error')
    }
  }

  return (
    <nav className="bg-black border-b border-gray-800 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 text-3xl font-handwriting text-white hover:text-gray-300 transition duration-200">
          <Image
            src="/logo.png"
            alt="Roomlet"
            width={24}
            height={24}
            className="w-6 h-6"
          />
          Roomlet
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex gap-4 items-center">
          <Link
            href="/gallery"
            className="text-gray-300 hover:text-white font-medium transition text-sm duration-200"
          >
            Gallery
          </Link>
          <Link
            href="/creators"
            className="text-gray-300 hover:text-white font-medium transition text-sm duration-200"
          >
            Profiles
          </Link>
          {/* Premium link temporarily disabled - payment provider setup needed */}
          {/* <Link
            href="/premium"
            className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 hover:from-purple-300 hover:to-pink-300 font-semibold transition text-sm duration-200"
          >
            Premium
          </Link> */}
          {isLoading ? (
            <div className="text-gray-400">Loading...</div>
          ) : user ? (
            <>
              <Link
                href="/dashboard"
                className="text-gray-300 hover:text-white font-medium transition text-sm duration-200"
              >
                Dashboard
              </Link>
              <Link
                href="/feed"
                className={`font-medium transition text-sm duration-200 ${
                  pathname === '/feed' 
                    ? 'text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Feed
              </Link>
              <Link
                href="/bookmarks"
                className="text-gray-300 hover:text-white font-medium transition text-sm duration-200"
              >
                Bookmarks
              </Link>
              {isAdmin && (
                <>
                  <Link
                    href="/admin/reports"
                    className="text-red-400 hover:text-red-300 font-medium transition text-sm duration-200 flex items-center gap-1"
                  >
                    <span className="text-xs bg-red-900 px-1.5 py-0.5 rounded">ADMIN</span>
                    Reports
                  </Link>
                  <Link
                    href="/admin/queue"
                    className="text-yellow-400 hover:text-yellow-300 font-medium transition text-sm duration-200 flex items-center gap-1"
                  >
                    <span className="text-xs bg-yellow-900 px-1.5 py-0.5 rounded">ADMIN</span>
                    Queue
                  </Link>
                </>
              )}
              
              {/* Desktop User Dropdown Menu */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDesktopMenuOpen(!desktopMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white transition text-sm rounded-lg duration-200"
                >
                  <Menu size={16} />
                  <ChevronDown size={14} className={`transition-transform ${desktopMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {desktopMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-lg overflow-hidden z-50">
                    {username && (
                      <Link
                        href={`/${username}`}
                        className="flex items-center gap-2 px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white transition text-sm"
                        onClick={() => setDesktopMenuOpen(false)}
                      >
                        <User size={16} />
                        My Profile
                      </Link>
                    )}
                    <a
                      href="https://eepymep.netlify.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white transition text-sm"
                      onClick={() => setDesktopMenuOpen(false)}
                    >
                      <span className="text-base">🐱</span>
                      Mep Discord Bot
                      <ExternalLink size={12} className="ml-auto opacity-50" />
                    </a>
                    <Link
                      href="/terms"
                      className="flex items-center gap-2 px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white transition text-sm"
                      onClick={() => setDesktopMenuOpen(false)}
                    >
                      <FileText size={16} />
                      Terms of Service
                    </Link>
                    <div className="border-t border-gray-700"></div>
                    
                    {/* NSFW Toggle */}
                    <button
                      onClick={() => {
                        toggleNSFW()
                        addToast(
                          nsfwEnabled ? 'NSFW content hidden' : 'NSFW content visible',
                          'success',
                          2000
                        )
                      }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white transition text-sm"
                    >
                      {nsfwEnabled ? <Eye size={16} /> : <EyeOff size={16} />}
                      <span>NSFW: {nsfwEnabled ? 'On' : 'Off'}</span>
                    </button>
                    
                    <div className="border-t border-gray-700"></div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-3 text-red-400 hover:bg-gray-800 hover:text-red-300 transition text-sm"
                    >
                      <LogOut size={16} />
                      Exit
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-gray-300 hover:text-white font-medium transition text-sm duration-200"
              >
                Enter
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 bg-white text-black hover:bg-gray-200 transition text-sm font-medium rounded-lg duration-200"
              >
                Begin
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-gray-300 hover:text-white transition"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-800 bg-black">
          <div className="px-6 py-4 space-y-3">
            <Link
              href="/gallery"
              className="block text-gray-300 hover:text-white font-medium transition text-sm duration-200 py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Gallery
            </Link>
            <Link
              href="/creators"
              className="block text-gray-300 hover:text-white font-medium transition text-sm duration-200 py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Profiles
            </Link>
            {/* Premium link temporarily disabled - payment provider setup needed */}
            {/* <Link
              href="/premium"
              className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 font-semibold transition text-sm duration-200 py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Premium
            </Link> */}
            {isLoading ? (
              <div className="text-gray-400">Loading...</div>
            ) : user ? (
              <>
                <Link
                  href="/dashboard"
                  className="block text-gray-300 hover:text-white font-medium transition text-sm duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <Link
                  href="/feed"
                  className={`flex items-center gap-2 font-medium transition text-sm duration-200 py-2 ${
                    pathname === '/feed'
                      ? 'text-white'
                      : 'text-gray-300 hover:text-white'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Rss size={16} />
                  Feed
                </Link>
                <Link
                  href="/bookmarks"
                  className="flex items-center gap-2 text-gray-300 hover:text-white font-medium transition text-sm duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Heart size={16} />
                  Bookmarks
                </Link>
                {isAdmin && (
                  <>
                    <Link
                      href="/admin/reports"
                      className="block text-red-400 hover:text-red-300 font-medium transition text-sm duration-200 py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <span className="text-xs bg-red-900 px-1.5 py-0.5 rounded mr-2">ADMIN</span>
                      Reports
                    </Link>
                    <Link
                      href="/admin/queue"
                      className="block text-yellow-400 hover:text-yellow-300 font-medium transition text-sm duration-200 py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <span className="text-xs bg-yellow-900 px-1.5 py-0.5 rounded mr-2">ADMIN</span>
                      Queue
                    </Link>
                  </>
                )}
                {username && (
                  <Link
                    href={`/${username}`}
                    className="flex items-center gap-2 text-gray-300 hover:text-white font-medium transition text-sm duration-200 py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <User size={16} />
                    My Profile
                  </Link>
                )}
                <a
                  href="https://eepymep.netlify.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gray-300 hover:text-white font-medium transition text-sm duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="text-base">🐱</span>
                  Mep Discord Bot
                  <ExternalLink size={12} className="ml-auto opacity-50" />
                </a>
                <Link
                  href="/terms"
                  className="flex items-center gap-2 text-gray-300 hover:text-white font-medium transition text-sm duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <FileText size={16} />
                  Terms of Service
                </Link>
                <div className="border-t border-gray-700 my-2"></div>
                
                {/* NSFW Toggle (Mobile Only) */}
                <button
                  onClick={() => {
                    toggleNSFW()
                    addToast(
                      nsfwEnabled ? 'NSFW content hidden' : 'NSFW content visible',
                      'success',
                      2000
                    )
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white transition text-sm"
                >
                  {nsfwEnabled ? <Eye size={16} /> : <EyeOff size={16} />}
                  <span>NSFW: {nsfwEnabled ? 'On' : 'Off'}</span>
                </button>
                
                <div className="border-t border-gray-700"></div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 border border-gray-700 text-red-400 hover:border-red-700 hover:text-red-300 transition text-sm rounded-lg duration-200"
                >
                  <LogOut size={16} />
                  Exit
                </button>
              </>
            ) : (
              <>
                <a
                  href="https://eepymep.netlify.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gray-300 hover:text-white font-medium transition text-sm duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="text-base">🐱</span>
                  Mep Discord Bot
                  <ExternalLink size={12} className="ml-auto opacity-50" />
                </a>
                <div className="border-t border-gray-700 my-2"></div>
                <Link
                  href="/login"
                  className="block text-gray-300 hover:text-white font-medium transition text-sm duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Enter
                </Link>
                <Link
                  href="/signup"
                  className="block w-full text-center px-4 py-2 bg-white text-black hover:bg-gray-200 transition text-sm font-medium rounded-lg duration-200"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Begin
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}