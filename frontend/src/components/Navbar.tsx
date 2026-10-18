'use client'

import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { useAuth } from '@/auth/auth.hooks'
import { postLoginPath } from '@/auth/access'

const links = [
  { href: '#how', label: 'วิธีใช้งาน' },
  { href: '#shops', label: 'สำหรับร้านค้า' },
  { href: '#schools', label: 'สำหรับโรงเรียน' },
  { href: '#faq', label: 'คำถาม' },
]

export default function Navbar() {
  const { user } = useAuth()

  return (
    <header className="relative border-b border-line-soft bg-white">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 sm:px-6 sm:py-3.5">
        <Link href="#top" className="flex items-center gap-2.5 text-brand-dark">
          <Logo size={36} />
          <span className="text-lg font-bold">PromptServe</span>
        </Link>
        <nav aria-label="เมนูหน้าแรก" className="flex flex-wrap items-center gap-1">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="flex min-h-11 items-center px-2.5 text-[15px] sm:px-3 font-medium text-[#344054] hover:text-primary-main">
              {l.label}
            </a>
          ))}
          {/* signed in → straight to the role's own home, not the ordering page */}
          <Link href={user ? postLoginPath(user) : '/login'} className="ml-2 flex h-11 items-center rounded-xl bg-primary-main px-[18px] text-[15px] font-semibold text-white hover:bg-primary-dark">
            {user ? 'หน้าหลักของฉัน' : 'เข้าสู่ระบบ'}
          </Link>
        </nav>
      </div>
    </header>
  )
}
