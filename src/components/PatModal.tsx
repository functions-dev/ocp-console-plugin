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
import { Octokit } from '@octokit/rest';
import { useTranslation } from 'react-i18next';

interface PatModalProps {
  isOpen: boolean;
  onSave: (pat: string) => void;
}

export function PatModal({ isOpen, onSave }: PatModalProps) {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const [token, setToken] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsValidating(true);
    setError('');

    try {
      const octokit = new Octokit({ auth: token });
      await octokit.users.getAuthenticated();
      onSave(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Modal
      isOpen
      variant="small"
      aria-label={t('GitHub Personal Access Token')}
    >
      <ModalHeader title={t('GitHub Personal Access Token')} />
      <ModalBody>
        {error && (
          <Alert variant="danger" title={t('Invalid token')} isInline>
            {error}
          </Alert>
        )}
        <Form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <FormGroup label={t('Personal Access Token')} isRequired fieldId="pat-input">
            <TextInput
              id="pat-input"
              type="password"
              isRequired
              value={token}
              onChange={(_e, val) => setToken(val)}
            />
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          onClick={handleSave}
          isDisabled={!token || isValidating}
          isLoading={isValidating}
        >
          {t('Save')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
