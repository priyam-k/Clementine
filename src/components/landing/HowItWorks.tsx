'use client'

import { motion } from 'framer-motion'

const steps = [
  {
    step: '01',
    title: 'Host opens the Dashboard',
    body: 'Clementine creates a session with a shareable QR code. Share it with anyone on your network.',
  },
  {
    step: '02',
    title: 'Workers scan and join',
    body: 'Any device scans the QR or enters the code. No install needed — runs entirely in the browser.',
  },
  {
    step: '03',
    title: 'Dispatch and harvest',
    body: 'Say "Hey Clementine, run…" and watch your job complete across every worker in real time.',
  },
]

export default function HowItWorks() {
  return (
    <section className="py-24 md:py-32 px-6 bg-[#FAF7F2]">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16 text-center"
        >
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#EF8354]">
            Three steps
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-[#120B09] tracking-tighter uppercase mt-2">
            From Idle to Compute
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-14">
          {steps.map(({ step, title, body }, i) => (
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: i * 0.12 }}
            >
              <span className="block text-7xl md:text-8xl font-black italic leading-none mb-6 text-[#EF8354]">
                {step}
              </span>
              <h3 className="font-black text-[#120B09] text-base uppercase tracking-tight mb-3">
                {title}
              </h3>
              <p className="text-[#4A3935]/70 text-sm leading-relaxed font-medium">{body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
