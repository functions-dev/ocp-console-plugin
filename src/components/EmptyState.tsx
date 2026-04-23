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

interface FunctionsEmptyStateProps {
  isCreateDisabled?: boolean;
}

export function FunctionsEmptyState({ isCreateDisabled }: FunctionsEmptyStateProps) {
  const { t } = useTranslation('plugin__console-functions-plugin');

  const button = (
    <Button
      variant="primary"
      isDisabled={isCreateDisabled}
      {...(!isCreateDisabled && {
        component: (props: React.ComponentProps<typeof Link>) => (
          <Link {...props} to="/faas/create" />
        ),
      })}
    >
      {t('Create function')}
    </Button>
  );

  return (
    <EmptyState headingLevel="h2" icon={CubesIcon} titleText={t('No functions found')}>
      <EmptyStateBody>{t('Create a serverless function to get started.')}</EmptyStateBody>
      <EmptyStateFooter>
        <EmptyStateActions>
          {isCreateDisabled ? (
            <Tooltip content={t('Connect to GitHub to create functions')}>
              <span>{button}</span>
            </Tooltip>
          ) : (
            button
          )}
        </EmptyStateActions>
      </EmptyStateFooter>
    </EmptyState>
  );
}
