'use client';
import { createContext, useContext } from 'react';
import type { Hero } from '@/lib/game/rules';
import { presentJobText } from '@/lib/game/job-presentation';
export const JobPresentationContext = createContext<Hero | undefined>(undefined);
export function useJobText() {
  const hero = useContext(JobPresentationContext);
  return (text: string) => presentJobText(hero, text);
}
export function JobText({ children }: { children: string | null | undefined }) {
  return useJobText()(children ?? '');
}
