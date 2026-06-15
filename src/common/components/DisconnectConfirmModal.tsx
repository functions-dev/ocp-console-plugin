import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';

interface DisconnectConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DisconnectConfirmModal({
  isOpen,
  onClose,
  onConfirm,
}: DisconnectConfirmModalProps) {
  const { t } = useTranslation('plugin__console-functions-plugin');

  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="small">
      <ModalHeader title={t('Disconnect from GitHub')} />
      <ModalBody>{t('Are you sure you want to disconnect from GitHub?')}</ModalBody>
      <ModalFooter>
        <Button variant="danger" onClick={onConfirm}>
          {t('Disconnect')}
        </Button>
        <Button variant="link" onClick={onClose}>
          {t('Cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
