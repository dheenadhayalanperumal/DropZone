'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// The customer drop experience now lives at the root ("/").
export default function PlayRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/'); }, [router]);
  return null;
}
