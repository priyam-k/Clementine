import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import Nav from '@/components/landing/Nav'
import Hero from '@/components/landing/Hero'
import Features from '@/components/landing/Features'

export default function LandingPage() {
  return (
    <div className="relative bg-[#FAF7F2]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-35"
        style={{
          backgroundImage: `
            radial-gradient(circle at top right, rgba(239,131,84,0.08), transparent 48%),
            repeating-linear-gradient(
              135deg,
              rgba(18,11,9,0.035) 0px,
              rgba(18,11,9,0.035) 1px,
              transparent 1px,
              transparent 18px
            )
          `,
        }}
      />

      <section className="relative bg-[#F2E6DD] border-b border-[#120B09]/6">
        <Nav />
        <Hero />
      </section>

      <section className="relative">
        <Features />
      </section>

      {/* CTA banner */}
      <section className="relative bg-[#EF8354] py-20 px-6 text-center">
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
      <footer className="relative bg-[#120B09] py-12 px-6">
        <div className="max-w-7xl mx-auto flex justify-center md:justify-start items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-white tracking-tighter uppercase italic">
                Clementine
              </span>
              <a
                href="https://github.com/priyam-k/Clementine/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/40 hover:text-white transition-colors"
                title="GitHub"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
              </a>
            </div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 mt-1">
              © 2026 The Orchard Collective
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
