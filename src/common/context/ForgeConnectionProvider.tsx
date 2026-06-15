import { createContext, ReactNode, useState } from 'react';
import { ForgeUser, TOKEN_KEY, USER_KEY } from '../services/types';

interface ForgeConnection {
  isActive: boolean;
  user: ForgeUser;
  connectionId: number;
  connectToForge: (user: ForgeUser) => void;
  disconnectFromForge: () => void;
}

export const ForgeConnectionContext = createContext<ForgeConnection>({
  isActive: false,
  user: { name: '' },
  connectionId: 0,
  connectToForge: () => {},
  disconnectFromForge: () => {},
});

export function ForgeConnectionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [isActive, setIsActive] = useState<boolean>(() => !!sessionStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<ForgeUser>(readStoredUser);
  const [connectionId, setConnectionId] = useState(0);

  const connectToForge = (forgeUser: ForgeUser) => {
    setUser(forgeUser);
    setIsActive(true);
    setConnectionId((id) => id + 1);
  };

  const disconnectFromForge = () => {
    setUser({ name: '' });
    setIsActive(false);
  };

  return (
    <ForgeConnectionContext.Provider
      value={{ isActive, user, connectionId, connectToForge, disconnectFromForge }}
    >
      {children}
    </ForgeConnectionContext.Provider>
  );
}

function readStoredUser(): ForgeUser {
  const userJson = sessionStorage.getItem(USER_KEY);
  if (!userJson) return { name: '' };
  try {
    return JSON.parse(userJson) as ForgeUser;
  } catch {
    return { name: '' };
  }
}
