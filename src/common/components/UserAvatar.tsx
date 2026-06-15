import { Button, Dropdown, DropdownItem, DropdownList, MenuToggle } from '@patternfly/react-core';
import { KeyIcon, UserIcon } from '@patternfly/react-icons';
import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ForgeConnectionContext } from '../context/ForgeConnectionProvider';
import { OAuthConfig } from '../services/oauth/OAuthService';
import { useOAuthService } from '../services/oauth/useOAuthService';
import { useSourceControlService } from '../services/source-control/useSourceControlService';
import { AUTH_METHOD_KEY, ForgeUser, TOKEN_KEY, USER_KEY } from '../services/types';
import { DisconnectConfirmModal } from './DisconnectConfirmModal';
import { PatModal } from './PatModal';

interface UserAvatarProps {
  enableReconnect: boolean;
}

export function UserAvatar({ enableReconnect }: UserAvatarProps) {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const {
    user,
    isModalOpen,
    isDropdownOpen,
    isConfirmOpen,
    oauthConfig,
    openModal,
    closeModal,
    loginWithPat,
    loginWithOAuth,
    toggleDropdown,
    closeDropdown,
    openConfirm,
    closeConfirm,
    disconnect,
  } = useUserAvatar(enableReconnect);

  if (user) {
    return (
      <>
        <Dropdown
          isOpen={isDropdownOpen}
          onSelect={closeDropdown}
          onOpenChange={(open) => !open && closeDropdown()}
          toggle={(toggleRef) => (
            <MenuToggle
              ref={toggleRef}
              onClick={toggleDropdown}
              variant="plain"
              icon={<UserIcon />}
            >
              {user.name}
            </MenuToggle>
          )}
          popperProps={{ position: 'end' }}
        >
          <DropdownList>
            <DropdownItem key="disconnect" onClick={openConfirm}>
              {t('Disconnect')}
            </DropdownItem>
          </DropdownList>
        </Dropdown>
        <DisconnectConfirmModal
          isOpen={isConfirmOpen}
          onClose={closeConfirm}
          onConfirm={disconnect}
        />
      </>
    );
  }

  return (
    <>
      <Button
        variant="link"
        icon={<KeyIcon />}
        onClick={enableReconnect ? openModal : undefined}
        isDisabled={!enableReconnect}
      >
        {t('Connect to GitHub')}
      </Button>
      <PatModal
        isOpen={isModalOpen}
        oauthConfig={oauthConfig}
        onClose={closeModal}
        onConnect={loginWithPat}
        onOAuth={loginWithOAuth}
      />
    </>
  );
}

function useUserAvatar(enableReconnect: boolean) {
  const sourceControlService = useSourceControlService();
  const oauthService = useOAuthService();
  const { connectToForge, disconnectFromForge } = useContext(ForgeConnectionContext);
  const [user, setUser] = useState<ForgeUser | null>(() => readStoredUser());
  const [isModalOpen, setIsModalOpen] = useState(
    () => enableReconnect && !sessionStorage.getItem(TOKEN_KEY),
  );
  const [oauthConfig, setOAuthConfig] = useState<OAuthConfig | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    oauthService
      .fetchConfig()
      .then(setOAuthConfig)
      .catch(() => {});
  }, [oauthService]);

  const finishLogin = (token: string, forgeUser: ForgeUser, method: 'pat' | 'oauth') => {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(forgeUser));
    sessionStorage.setItem(AUTH_METHOD_KEY, method);
    setUser(forgeUser);
    setIsModalOpen(false);
    connectToForge(forgeUser);
  };

  const loginWithPat = async (pat: string) => {
    const forgeUser = await sourceControlService.fetchUserInfo(pat);
    finishLogin(pat, forgeUser, 'pat');
  };

  const loginWithOAuth = async () => {
    const token = await oauthService.startFlow();
    const forgeUser = await sourceControlService.fetchUserInfo(token);
    finishLogin(token, forgeUser, 'oauth');
  };

  const disconnect = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(AUTH_METHOD_KEY);
    setUser(null);
    setIsConfirmOpen(false);
    disconnectFromForge();
  };

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);
  const toggleDropdown = () => setIsDropdownOpen((prev) => !prev);
  const closeDropdown = () => setIsDropdownOpen(false);
  const openConfirm = () => setIsConfirmOpen(true);
  const closeConfirm = () => setIsConfirmOpen(false);

  return {
    user,
    isModalOpen,
    isDropdownOpen,
    isConfirmOpen,
    oauthConfig,
    openModal,
    closeModal,
    loginWithPat,
    loginWithOAuth,
    toggleDropdown,
    closeDropdown,
    openConfirm,
    closeConfirm,
    disconnect,
  };
}

function readStoredUser(): ForgeUser | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const userJson = sessionStorage.getItem(USER_KEY);

  if (!token || !userJson) {
    return null;
  }

  try {
    return JSON.parse(userJson) as ForgeUser;
  } catch {
    return null;
  }
}
