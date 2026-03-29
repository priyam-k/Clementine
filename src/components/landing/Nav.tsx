'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 flex justify-between items-center w-full px-6 md:px-10 py-5 transition-all duration-300 ${
        scrolled
          ? 'bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#120B09]/8'
          : 'bg-transparent'
      }`}
    >
      <div className="flex items-center gap-10">
        <span className="text-xl font-black text-[#6f0600] tracking-tighter uppercase italic leading-none">
          Clementine
        </span>
        <nav className="hidden md:flex gap-8">
          {['Product', 'Docs', 'Network'].map((item) => (
            <a
              key={item}
              href="#how-it-works"
              className="text-[#120B09]/50 hover:text-[#120B09] font-bold text-xs uppercase tracking-widest transition-colors"
            >
              {item}
            </a>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/join"
          className="hidden md:inline-flex px-5 py-2.5 border border-[#120B09]/15 text-[#120B09] font-black text-[10px] uppercase tracking-widest hover:bg-[#F5F1EE] transition-all rounded-sm"
        >
          Join as Worker
        </Link>
        <Link
          href="/host"
          className="px-5 py-2.5 bg-[#120B09] text-white font-black text-[10px] uppercase tracking-widest hover:bg-[#EF8354] transition-all rounded-sm flex items-center gap-2"
        >
          Open Dashboard <ArrowUpRight size={12} />
        </Link>
      </div>
    </header>
  )
}
