import React from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';

// Slide each page in on phones only; desktop renders the page untouched.
export default function PageTransition({ children }) {
  const { pathname } = useLocation();
  const isMobile = useIsMobile();

  if (!isMobile) return children;

  return (
    <motion.div
      key={pathname}
      className="flex-1 min-h-0 flex flex-col"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}