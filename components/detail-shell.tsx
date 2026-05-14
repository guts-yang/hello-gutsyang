'use client';

import { motion } from 'framer-motion';
import { GlassCard } from './glass-card';

/**
 * Detail page wrapper that animates in from the matching card on the home page,
 * using Framer Motion's `layoutId` to share layout with the source card.
 */
export function DetailShell({
  layoutId,
  children,
}: {
  layoutId: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div layoutId={layoutId} className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <GlassCard className="p-0">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="space-y-6"
        >
          {children}
        </motion.div>
      </GlassCard>
    </motion.div>
  );
}
