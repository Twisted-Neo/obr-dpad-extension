'use client';

import dynamic from 'next/dynamic';

// Force Next.js to completely skip compiling this module during build rendering.
const DpadExtensionClientOnly = dynamic(
  () => import('../../components/DpadExtension'),
  { 
    ssr: false,
    loading: () => <div className="p-4 text-sm text-gray-400 animate-pulse bg-slate-900 min-h-screen">Loading controller system...</div>
  }
);

export default function ExtensionRoutePage() {
  return <DpadExtensionClientOnly />;
}
