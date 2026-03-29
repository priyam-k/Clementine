import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import Nav from '@/components/landing/Nav'
import Hero from '@/components/landing/Hero'
import Features from '@/components/landing/Features'
import HowItWorks from '@/components/landing/HowItWorks'

export default function LandingPage() {
  return (
    <div className="bg-[#FAF7F2]">
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />

      {/* CTA banner */}
      <section className="bg-[#EF8354] py-20 px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase mb-4">
          Ready to Harvest?
        </h2>
        <p className="text-white/80 text-sm font-medium mb-8 max-w-md mx-auto">
          Start your session in seconds. No cloud, no fees, no data leaving your home.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/host"
            className="px-10 py-4 bg-[#120B09] text-white font-black text-xs uppercase tracking-widest hover:bg-white hover:text-[#120B09] transition-all rounded-sm flex items-center gap-2"
          >
            Open Dashboard <ArrowUpRight size={13} />
          </Link>
          <Link
            href="/join"
            className="px-10 py-4 bg-white/20 text-white font-black text-xs uppercase tracking-widest hover:bg-white/30 transition-all rounded-sm border border-white/20"
          >
            Join as Worker
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#120B09] py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div>
            <span className="text-2xl font-black text-white tracking-tighter uppercase italic">
              Clementine
            </span>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 mt-1">
              © 2026 The Orchard Collective
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            {['Documentation', 'Privacy Policy', 'Status', 'GitHub'].map((item) => (
              <a
                key={item}
                href="#"
                className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors"
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
