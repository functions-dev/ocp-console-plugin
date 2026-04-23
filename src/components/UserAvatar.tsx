import { Button } from '@patternfly/react-core';
import { KeyIcon, UserIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { usePatContext } from '../hooks/usePatContext';

interface UserAvatarProps {
  clickable?: boolean;
}

export function UserAvatar({ clickable = false }: UserAvatarProps) {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const { isConnected, username, openModal } = usePatContext();

  if (isConnected) {
    if (clickable) {
      return (
        <Button variant="link" icon={<UserIcon />} onClick={openModal}>
          {username}
        </Button>
      );
    }
    return (
      <span>
        <UserIcon /> {username}
      </span>
    );
  }

  if (clickable) {
    return (
      <Button variant="link" icon={<KeyIcon />} onClick={openModal}>
        {t('Connect to GitHub')}
      </Button>
    );
  }

  return (
    <span>
      <KeyIcon /> {t('Connect to GitHub')}
    </span>
  );
}
