import Link from "next/link";
import { ArrowUpRight, Cpu, Network, Zap, Shield } from "lucide-react";

const features = [
  {
    icon: Network,
    title: "Distributed Mesh",
    body: "Any device on your local network joins as a worker — phone, tablet, or laptop.",
  },
  {
    icon: Zap,
    title: "Voice Dispatch",
    body: 'Say "Hey Clementine" and dictate your compute job. No config files, no CLI.',
  },
  {
    icon: Cpu,
    title: "Real Compute",
    body: "Jobs split into subtasks and distributed intelligently by each worker's capacity.",
  },
  {
    icon: Shield,
    title: "Stays Local",
    body: "Your data never leaves your network. Everything runs on your own hardware.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="bg-[#FCFAF8]/90 backdrop-blur-md border-b border-[#120B09]/8 flex justify-between items-center w-full px-6 md:px-10 py-5 sticky top-0 z-40">
        <div className="flex items-center gap-10">
          <span className="text-xl font-black text-[#6f0600] tracking-tighter uppercase italic leading-none">
            Clementine
          </span>
          <nav className="hidden md:flex gap-8">
            {["Product", "Docs", "Network"].map((item) => (
              <a key={item} href="#how-it-works" className="text-[#120B09]/50 hover:text-[#120B09] font-bold text-xs uppercase tracking-widest transition-colors font-[Inter,sans-serif]">
                {item}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/join" className="hidden md:inline-flex px-5 py-2.5 border border-[#120B09]/15 text-[#120B09] font-black text-[10px] uppercase tracking-widest hover:bg-[#F5F1EE] transition-all rounded-sm font-[Inter,sans-serif]">
            Join as Worker
          </Link>
          <Link href="/host" className="px-5 py-2.5 bg-[#120B09] text-white font-black text-[10px] uppercase tracking-widest hover:bg-[#EF8354] transition-all rounded-sm font-[Inter,sans-serif] flex items-center gap-2">
            Open Dashboard <ArrowUpRight size={12} />
          </Link>
        </div>
      </header>

      {/* Hero — two-column layout */}
      <section className="relative overflow-hidden px-6 pt-20 pb-16 md:pt-28 md:pb-20 flex flex-col md:flex-row items-center gap-12">
        {/* Decorative grid */}
        <div className="absolute inset-0 pointer-events-none opacity-30" style={{ backgroundImage: `linear-gradient(to right, #EF835408 1px, transparent 1px), linear-gradient(to bottom, #EF835408 1px, transparent 1px)`, backgroundSize: "80px 80px" }} />

        {/* Left column — text content */}
        <div className="relative z-10 flex-1 max-w-2xl space-y-8">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-white border border-[#EDE7E3] rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#EF8354] animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#EF8354] font-[Inter,sans-serif]">
              Vol. 01 — Distributed Computing
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-6xl md:text-8xl lg:text-[7rem] font-black text-[#120B09] tracking-tighter leading-[0.88] uppercase">
            The <span className="text-[#6f0600] italic">Heirloom</span><br />Network.
          </h1>

          {/* Subhead */}
          <p className="text-lg md:text-xl text-[#4A3935] max-w-xl leading-relaxed font-medium">
            Reject generic clouds. Transform idle home devices into a private compute cluster.
            Plant your tasks and harvest local results.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-start gap-3 pt-2">
            <Link href="/host" className="w-full sm:w-auto bg-[#EF8354] text-white px-10 py-5 text-xs font-black uppercase tracking-widest hover:bg-[#120B09] transition-all flex items-center justify-center gap-3 rounded-sm">
              Enter Dashboard <ArrowUpRight size={14} />
            </Link>
            <Link href="/join" className="w-full sm:w-auto bg-white border border-[#120B09]/15 text-[#120B09] px-10 py-5 text-xs font-black uppercase tracking-widest hover:bg-[#F5F1EE] transition-all flex items-center justify-center gap-3 rounded-sm">
              Join as Worker
            </Link>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-3 gap-3 max-w-lg pt-6">
            {[
              { val: "Local", label: "Private network" },
              { val: "Any", label: "Device supported" },
              { val: "Live", label: "Real-time results" },
            ].map(({ val, label }) => (
              <div key={label} className="bg-white/80 backdrop-blur-sm border border-[#120B09]/5 rounded-sm px-4 py-4 text-center shadow-sm">
                <p className="text-2xl font-black text-[#EF8354] tracking-tighter">{val}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/50 font-[Inter,sans-serif] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right column — looping video */}
        <div className="relative z-10 hidden md:flex flex-1 items-center justify-center">
          <video
            src="/hero.mp4"
            autoPlay
            muted
            loop
            playsInline
            className="w-full max-w-lg rounded-xl object-cover shadow-2xl"
          />
        </div>
      </section>

      {/* Feature strip */}
      <section id="how-it-works" className="bg-[#120B09] py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#EF8354] font-[Inter,sans-serif]">How it works</span>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase mt-2">Distributed by Design</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-white/5 border border-white/8 rounded-sm p-6 hover:bg-white/8 hover:border-[#EF8354]/30 transition-all">
                <div className="w-10 h-10 rounded-sm bg-[#EF8354]/15 flex items-center justify-center mb-4">
                  <Icon size={18} className="text-[#EF8354]" />
                </div>
                <h3 className="font-black text-white text-sm uppercase tracking-tight mb-2">{title}</h3>
                <p className="text-white/50 text-xs leading-relaxed font-medium">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process steps */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#EF8354] font-[Inter,sans-serif]">Three steps</span>
            <h2 className="text-4xl font-black text-[#120B09] tracking-tighter uppercase mt-2">From Idle to Compute</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: "01", title: "Host opens the Dashboard", body: "Clementine creates a session with a shareable QR code. Share it with anyone on your network.", color: "text-[#EF8354]" },
              { step: "02", title: "Workers scan and join", body: "Any device scans the QR or enters the code. No install needed — runs entirely in the browser.", color: "text-[#6f0600]" },
              { step: "03", title: "Dispatch and harvest", body: 'Say "Hey Clementine, run…" and watch your job complete across every worker in real time.', color: "text-[#EF8354]" },
            ].map(({ step, title, body, color }) => (
              <div key={step} className="bg-white border border-[#120B09]/5 rounded-sm p-8 hover:border-[#EF8354]/20 hover:shadow-md transition-all">
                <span className={`text-5xl font-black ${color} tracking-tighter italic`}>{step}</span>
                <h3 className="font-black text-[#120B09] text-base uppercase tracking-tight mt-4 mb-2">{title}</h3>
                <p className="text-[#4A3935]/60 text-sm leading-relaxed font-medium">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="bg-[#EF8354] py-16 px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase mb-4">Ready to Harvest?</h2>
        <p className="text-white/80 text-sm font-medium mb-8 max-w-md mx-auto">Start your session in seconds. No cloud, no fees, no data leaving your home.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/host" className="px-10 py-4 bg-[#120B09] text-white font-black text-xs uppercase tracking-widest hover:bg-white hover:text-[#120B09] transition-all rounded-sm flex items-center gap-2">
            Open Dashboard <ArrowUpRight size={13} />
          </Link>
          <Link href="/join" className="px-10 py-4 bg-white/20 text-white font-black text-xs uppercase tracking-widest hover:bg-white/30 transition-all rounded-sm border border-white/20">
            Join as Worker
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#120B09] py-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div>
            <span className="text-2xl font-black text-white tracking-tighter uppercase italic">Clementine</span>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 mt-1 font-[Inter,sans-serif]">© 2026 The Orchard Collective</p>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            {["Documentation", "Privacy Policy", "Status", "GitHub"].map((item) => (
              <a key={item} href="#" className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors font-[Inter,sans-serif]">{item}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
