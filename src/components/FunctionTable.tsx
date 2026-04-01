import { useState } from 'react';
import { Pagination } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FunctionListItem } from '../services/types';

const PER_PAGE = 20;

export function FunctionTable({ functions }: { functions: FunctionListItem[] }) {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const [page, setPage] = useState(1);
  const showPagination = functions.length > PER_PAGE;
  const start = (page - 1) * PER_PAGE;
  const visible = showPagination ? functions.slice(start, start + PER_PAGE) : functions;

  return (
    <>
      <Table aria-label={t('Functions')}>
        <Thead>
          <Tr>
            <Th>{t('name')}</Th>
            <Th>{t('runtime')}</Th>
            <Th>{t('status')}</Th>
            <Th>{t('url')}</Th>
            <Th>{t('replicas')}</Th>
            <Th>{t('actions')}</Th>
          </Tr>
        </Thead>
        <Tbody>
          {visible.map((fn) => (
            <Tr key={fn.name}>
              <Td>
                <Link to={`/functions/edit/${fn.name}`}>{fn.name}</Link>
              </Td>
              <Td>{fn.runtime}</Td>
              <Td>{fn.status}</Td>
              <Td>
                {fn.url ? (
                  <a href={fn.url} target="_blank" rel="noopener noreferrer">
                    {fn.url.replace(/^https?:\/\//, '')}
                  </a>
                ) : (
                  '-'
                )}
              </Td>
              <Td>{fn.replicas}</Td>
              <Td>
                <Link to={`/functions/edit/${fn.name}`} aria-label={t('edit')}>
                  {t('edit')}
                </Link>
                <button type="button" aria-label={t('delete')}>
                  {t('delete')}
                </button>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      {showPagination && (
        <Pagination
          itemCount={functions.length}
          perPage={PER_PAGE}
          page={page}
          onSetPage={(_e, p) => setPage(p)}
        />
      )}
    </>
  );
}
