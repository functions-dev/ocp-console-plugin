import { ReactNode } from 'react';
import { PatProvider } from '../contexts/PatContext';

export function PageWrapper({ children }: { children: ReactNode }) {
  return <PatProvider>{children}</PatProvider>;
}
