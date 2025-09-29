'use client';

import { redirect } from 'next/navigation';
import { useEffect } from 'react';

export default function SearchPage() {
  useEffect(() => {
    // Redirect to posts page where search functionality is available
    redirect('/posts');
  }, []);

  return null;
}
