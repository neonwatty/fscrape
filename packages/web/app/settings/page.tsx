'use client';

import { redirect } from 'next/navigation';
import { useEffect } from 'react';

export default function SettingsPage() {
  useEffect(() => {
    // Redirect to home page as settings are handled via modals
    redirect('/');
  }, []);

  return null;
}
