import { useState } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  TextInput,
  FormGroup,
  Alert,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { usePatContext } from '../hooks/usePatContext';

export function PatModal() {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const { isModalOpen, closeModal, submitPat, error } = usePatContext();
  const [pat, setPat] = useState('');

  const handleConnect = async () => {
    await submitPat(pat);
  };

  const handleClose = () => {
    setPat('');
    closeModal();
  };

  return (
    <Modal
      isOpen={isModalOpen}
      onClose={handleClose}
      aria-label={t('Connect to GitHub')}
      variant="small"
    >
      <ModalHeader title={t('Connect to GitHub')} />
      <ModalBody>
        {error && (
          <Alert variant="danger" title={t('Authentication failed')} isInline isPlain>
            {error}
          </Alert>
        )}
        <FormGroup label={t('Personal access token')} isRequired fieldId="pat-input">
          <TextInput
            id="pat-input"
            type="password"
            value={pat}
            onChange={(_, val) => setPat(val)}
            aria-label={t('Personal access token')}
          />
        </FormGroup>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={handleConnect} isDisabled={!pat}>
          {t('Connect')}
        </Button>
        <Button variant="link" onClick={handleClose}>
          {t('Cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
