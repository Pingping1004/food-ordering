'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#FFFBF5]/95 backdrop-blur-md shadow-sm border-b border-blue-100' : 'bg-transparent'
      }`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2 group">
            <Image src="/favicon.svg" alt="PromptServe Logo" width={32} height={32} className="w-8 h-8 group-hover:scale-105 transition-transform" />
            <span className="font-display font-bold text-lg text-slate-900">PromptServe</span>
          </a>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {[
              { id: 'features', label: 'ฟีเจอร์' },
              { id: 'how-it-works', label: 'วิธีใช้งาน' },
              { id: 'for-restaurants', label: 'สำหรับร้านอาหาร' },
              { id: 'faq', label: 'คำถามที่พบบ่อย' }
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="text-sm font-medium text-slate-500 hover:text-primary-main transition-colors"
              >
                <p className="text-black">{item.label}</p>
              </a>
            ))}
          </div>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-blue-50 transition-colors flex flex-col justify-center items-center gap-1.5 w-10 h-10"
          >
            <span className={`block w-6 h-0.5 bg-black rounded-full transition-all ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
            <span className={`block w-6 h-0.5 bg-black rounded-full transition-all ${mobileOpen ? 'opacity-0' : ''}`}></span>
            <span className={`block w-6 h-0.5 bg-black rounded-full transition-all ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden bg-[#FFFBF5] border-t border-blue-100 py-4 space-y-1">
            {[
              { id: 'features', label: 'ฟีเจอร์' },
              { id: 'how-it-works', label: 'วิธีใช้งาน' },
              { id: 'for-restaurants', label: 'สำหรับร้านอาหาร' },
              { id: 'faq', label: 'คำถามที่พบบ่อย' }
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-primary-main hover:bg-blue-50 rounded-lg transition-colors"
              >
                {item.label}
              </a>
            ))}
            <div className="px-4 pt-2">
              <Link
                href="/user/restaurant"
                className="block text-center bg-primary-main text-white text-sm font-semibold px-4 py-3 rounded-xl hover:bg-blue-600 transition-colors"
              >
                เริ่มสั่งอาหารเลย →
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
