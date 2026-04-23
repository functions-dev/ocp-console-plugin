import { useState } from 'react';
import { Button } from '@patternfly/react-core';
import { KeyIcon, UserIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { useUserAvatar } from '../hooks/useUserAvatar';
import { PatModal } from './PatModal';

interface UserAvatarProps {
  clickable: boolean;
}

export function UserAvatar({ clickable }: UserAvatarProps) {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const { isConnected, user } = useUserAvatar();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const label = isConnected && user ? user.login : t('Connect to GitHub');
  const icon = isConnected ? <UserIcon /> : <KeyIcon />;

  if (clickable) {
    return (
      <>
        <Button variant="plain" onClick={() => setIsModalOpen(true)} icon={icon}>
          {label}
        </Button>
        <PatModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  return (
    <span>
      {icon} {label}
    </span>
  );
}
