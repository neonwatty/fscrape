'use client';

import { redirect } from 'next/navigation';
import { useEffect } from 'react';

export default function AnalyticsPage() {
  useEffect(() => {
    // Redirect to home page as analytics is part of the main dashboard
    redirect('/');
  }, []);

  return null;
}
