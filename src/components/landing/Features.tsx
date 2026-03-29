'use client'

// Self-contained 'use client' component — Lucide icons defined here,
// NOT passed as props from the Server Component (Next.js 16 App Router constraint)

import { motion } from 'framer-motion'
import { Network, Zap, Cpu, Shield } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const features: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Network,
    title: 'Distributed Mesh',
    body: 'Any device on your local network joins as a worker — phone, tablet, or laptop.',
  },
  {
    icon: Zap,
    title: 'Voice Dispatch',
    body: 'Say "Hey Clementine" and dictate your compute job. No config files, no CLI.',
  },
  {
    icon: Cpu,
    title: 'Real Compute',
    body: "Jobs split into subtasks and distributed intelligently by each worker's capacity.",
  },
  {
    icon: Shield,
    title: 'Stays Local',
    body: 'Your data never leaves your network. Everything runs on your own hardware.',
  },
]

export default function Features() {
  return (
    <section id="how-it-works" className="bg-[#120B09] py-24 md:py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-14 text-center"
        >
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#EF8354]">
            How it works
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase mt-2">
            Distributed by Design
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map(({ icon: Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-white/[0.04] border border-white/[0.07] rounded-sm p-6 hover:bg-white/[0.07] hover:border-[#EF8354]/25 transition-all"
            >
              <div className="w-10 h-10 rounded-sm bg-[#EF8354]/15 flex items-center justify-center mb-4">
                <Icon size={18} className="text-[#EF8354]" />
              </div>
              <h3 className="font-black text-white text-sm uppercase tracking-tight mb-2">
                {title}
              </h3>
              <p className="text-white/50 text-xs leading-relaxed font-medium">{body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
