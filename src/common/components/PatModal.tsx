import {
  Alert,
  Button,
  Divider,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
  Tooltip,
} from '@patternfly/react-core';
import { GithubIcon } from '@patternfly/react-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OAuthConfig } from '../services/oauth/OAuthService';
import { errorMessage } from '../utils/utils';

interface PatModalProps {
  isOpen: boolean;
  oauthConfig: OAuthConfig | null;
  onClose: () => void;
  onConnect: (pat: string) => Promise<void>;
  onOAuth: () => Promise<void>;
}

export function PatModal({ isOpen, oauthConfig, onClose, onConnect, onOAuth }: PatModalProps) {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const {
    pat,
    isValidating,
    isOAuthInProgress,
    error,
    setPat,
    handleConnect,
    handleOAuth,
    handleClose,
  } = usePatModal(onClose, onConnect, onOAuth);

  const oauthEnabled = oauthConfig?.enabled ?? false;
  const isBusy = isValidating || isOAuthInProgress;

  const oauthButton = (
    <Button
      className="pf-v6-u-my-md"
      variant="secondary"
      icon={<GithubIcon />}
      isAriaDisabled={!oauthEnabled || isBusy}
      isLoading={isOAuthInProgress}
      isBlock
      onClick={oauthEnabled && !isBusy ? handleOAuth : undefined}
      data-test="oauth-button"
    >
      {t('Sign in with GitHub')}
    </Button>
  );

  return (
    <Modal isOpen={isOpen} onClose={isBusy ? undefined : handleClose} variant="small">
      <ModalHeader title={t('Connect to GitHub')} />
      <ModalBody>
        {error && <Alert variant="danger" title={error} isInline className="pf-v6-u-mb-md" />}
        {oauthEnabled ? (
          oauthButton
        ) : (
          <Tooltip content={t('OAuth is not configured. Contact your cluster administrator.')}>
            {oauthButton}
          </Tooltip>
        )}
        <Flex
          className="pf-v6-u-my-md"
          alignItems={{ default: 'alignItemsCenter' }}
          spaceItems={{ default: 'spaceItemsSm' }}
        >
          <FlexItem flex={{ default: 'flex_1' }}>
            <Divider />
          </FlexItem>
          <FlexItem>{t('or')}</FlexItem>
          <FlexItem flex={{ default: 'flex_1' }}>
            <Divider />
          </FlexItem>
        </Flex>
        <Form>
          <FormGroup label={t('Personal Access Token')} fieldId="pat-input">
            <TextInput
              id="pat-input"
              type="password"
              value={pat}
              onChange={(_, value) => setPat(value)}
              isDisabled={isBusy}
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  {t('Enter your GitHub Personal Access Token to connect your repositories.')}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          onClick={handleConnect}
          isDisabled={!pat || isBusy}
          isLoading={isValidating}
        >
          {t('Connect')}
        </Button>
        <Button variant="link" onClick={handleClose} isDisabled={isBusy}>
          {t('Cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function usePatModal(
  onClose: () => void,
  onConnect: (pat: string) => Promise<void>,
  onOAuth: () => Promise<void>,
) {
  const [pat, setPat] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isOAuthInProgress, setIsOAuthInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setIsValidating(true);
    setError(null);
    try {
      await onConnect(pat);
      setPat('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsValidating(false);
    }
  };

  const handleOAuth = async () => {
    setIsOAuthInProgress(true);
    setError(null);
    try {
      await onOAuth();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsOAuthInProgress(false);
    }
  };

  const handleClose = () => {
    setPat('');
    setError(null);
    onClose();
  };

  return {
    pat,
    isValidating,
    isOAuthInProgress,
    error,
    setPat,
    handleConnect,
    handleOAuth,
    handleClose,
  };
}
