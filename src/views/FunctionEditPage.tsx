import { DocumentTitle, ListPageHeader } from '@openshift-console/dynamic-plugin-sdk';
import { PageSection } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom-v5-compat';
import { PageWrapper } from '../components/PageWrapper';
import { UserAvatar } from '../components/UserAvatar';

export default function FunctionEditPage() {
  return (
    <PageWrapper>
      <FunctionEditPageContent />
    </PageWrapper>
  );
}

function FunctionEditPageContent() {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const { name } = useParams<{ name: string }>();

  return (
    <>
      <DocumentTitle>{t('Edit function')}</DocumentTitle>
      <ListPageHeader title={`${t('Edit function')}: ${name}`}>
        <UserAvatar clickable={false} />
      </ListPageHeader>
      <PageSection>{t('Coming soon.')}</PageSection>
    </>
  );
}
