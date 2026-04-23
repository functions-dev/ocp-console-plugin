import { useState } from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { useUserAvatar } from '../hooks/useUserAvatar';

interface PatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PatModal({ isOpen, onClose }: PatModalProps) {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const { submitPat, validating, error, clearError } = useUserAvatar();
  const [token, setToken] = useState('');

  const handleConnect = async () => {
    const success = await submitPat(token);
    if (success) {
      setToken('');
      onClose();
    }
  };

  const handleCancel = () => {
    setToken('');
    clearError();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal variant="small" isOpen onClose={handleCancel} aria-label={t('Connect to GitHub')}>
      <ModalHeader title={t('Connect to GitHub')} />
      <ModalBody>
        {error && (
          <Alert variant="danger" title={t('Authentication failed')} isInline isPlain>
            {error}
          </Alert>
        )}
        <Form>
          <FormGroup label={t('Personal access token')} isRequired fieldId="pat-input">
            <TextInput
              id="pat-input"
              type="password"
              value={token}
              onChange={(_event, value) => setToken(value)}
              aria-label={t('Personal access token')}
            />
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          onClick={handleConnect}
          isDisabled={!token || validating}
          isLoading={validating}
        >
          {t('Connect')}
        </Button>
        <Button variant="link" onClick={handleCancel}>
          {t('Cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
