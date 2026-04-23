import { createContext, useContext } from 'react';

export interface PatContextValue {
  isConnected: boolean;
  username: string | null;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  submitPat: (pat: string) => Promise<void>;
  error: string | null;
}

export const PatContext = createContext<PatContextValue>({
  isConnected: false,
  username: null,
  isModalOpen: false,
  openModal: () => {},
  closeModal: () => {},
  submitPat: async () => {},
  error: null,
});

export function usePatContext(): PatContextValue {
  return useContext(PatContext);
}
