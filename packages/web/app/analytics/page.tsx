'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AnalyticsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home page - analytics heatmap will be added to dashboard
    router.replace('/');
  }, [router]);

  return null;
}
