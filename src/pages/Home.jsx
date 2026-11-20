import React from 'react';
import Library from '@/pages/Library';
import SimpleConsole from '@/components/dj/SimpleConsole';
import { useSimpleMode } from '@/lib/simpleMode';

// The home route is the full library, or the stripped-back console in simple mode.
export default function Home() {
  const { enabled } = useSimpleMode();
  return enabled ? <SimpleConsole /> : <Library />;
}