import { EmptyState, EmptyStateBody, Spinner } from '@patternfly/react-core';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export default function OAuthCallbackPage() {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const sent = useRef(false);

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  const errorDescription = params.get('error_description');

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    if (!window.opener) return;

    if (error) {
      window.opener.postMessage(
        { type: 'oauth-error', error: errorDescription || error },
        window.location.origin,
      );
    } else if (code && state) {
      window.opener.postMessage({ type: 'oauth-callback', code, state }, window.location.origin);
    }

    setTimeout(() => window.close(), 300);
  }, [code, state, error, errorDescription]);

  if (!window.opener) {
    return (
      <EmptyState headingLevel="h2" titleText={t('Invalid access')}>
        <EmptyStateBody>
          {t('This page should be opened via the GitHub sign-in flow.')}
        </EmptyStateBody>
      </EmptyState>
    );
  }

  if (error) {
    return (
      <EmptyState headingLevel="h2" titleText={t('Authorization denied')}>
        <EmptyStateBody>{errorDescription || error}</EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <EmptyState headingLevel="h2" titleText={t('Authorization successful')} icon={Spinner}>
      <EmptyStateBody>{t('This window will close automatically.')}</EmptyStateBody>
    </EmptyState>
  );
}
