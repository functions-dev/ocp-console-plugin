import {
  Button,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  Tooltip,
} from '@patternfly/react-core';
import { CubesIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom-v5-compat';
import { usePatContext } from '../hooks/usePatContext';

export function FunctionsEmptyState() {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const { isConnected } = usePatContext();

  return (
    <EmptyState headingLevel="h2" icon={CubesIcon} titleText={t('No functions found')}>
      <EmptyStateBody>
        {isConnected
          ? t('Create a serverless function to get started.')
          : t('Connect to GitHub using the button in the top-right corner to see your functions.')}
      </EmptyStateBody>
      <EmptyStateFooter>
        <EmptyStateActions>
          {isConnected ? (
            <Button
              variant="primary"
              component={(props) => <Link {...props} to="/faas/create" />}
            >
              {t('Create function')}
            </Button>
          ) : (
            <Tooltip content={t('Connect to GitHub to create functions')}>
              <Button variant="primary" isDisabled>
                {t('Create function')}
              </Button>
            </Tooltip>
          )}
        </EmptyStateActions>
      </EmptyStateFooter>
    </EmptyState>
  );
}
