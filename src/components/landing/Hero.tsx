'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'

// Must be called at module top-level inside a 'use client' component (Next.js 16 requirement)
const ClusterOrb = dynamic(() => import('@/components/three/ClusterOrb'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-[#EDE5D8]" />,
})

const HEADLINE = [
  { text: 'THE',      className: 'text-[#120B09]' },
  { text: 'HEIRLOOM', className: 'text-[#6f0600] italic' },
  { text: 'NETWORK.', className: 'text-[#120B09]' },
]

export default function Hero() {
  return (
    <section className="relative bg-[#FAF7F2] min-h-[90vh] flex items-center overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-10 w-full py-20 lg:py-0 grid grid-cols-1 lg:grid-cols-[54%_46%] gap-8 lg:gap-6 items-center">

        {/* Text column */}
        <div className="space-y-8">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-[10px] font-black uppercase tracking-[0.3em] text-[#EF8354]"
          >
            Distributed Computing — Vol. 01
          </motion.p>

          <div>
            {HEADLINE.map(({ text, className }, i) => (
              <motion.span
                key={text}
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.65,
                  delay: 0.25 + i * 0.15,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                className={`block text-[15vw] sm:text-[12vw] lg:text-[7.5rem] xl:text-[8.5rem] font-black tracking-tighter leading-[0.85] ${className}`}
              >
                {text}
              </motion.span>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="text-base md:text-lg text-[#4A3935] max-w-md leading-relaxed font-medium"
          >
            Reject the cloud. Transform idle home devices into a private compute
            cluster. Plant your tasks, harvest local results.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.95 }}
            className="flex flex-wrap items-center gap-8 pt-2"
          >
            <Link
              href="/host"
              className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[#120B09] border-b-2 border-[#EF8354] pb-0.5 hover:text-[#EF8354] transition-colors"
            >
              Enter Dashboard <ArrowUpRight size={14} />
            </Link>
            <Link
              href="/join"
              className="inline-flex items-center gap-1 text-sm font-black uppercase tracking-widest text-[#4A3935]/55 hover:text-[#4A3935] transition-colors"
            >
              Join as Worker
            </Link>
          </motion.div>
        </div>

        {/* 3D orb column — bleeds slightly past the right boundary for an editorial feel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.7, ease: 'easeOut' }}
          className="hidden lg:flex justify-end lg:translate-x-14 xl:translate-x-20"
        >
          <div className="rounded-2xl overflow-hidden bg-[#EDE5D8] aspect-square w-full max-w-[520px]">
            <ClusterOrb />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
