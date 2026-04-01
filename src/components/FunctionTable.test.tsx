import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FunctionListItem } from '../services/types';
import { FunctionTable } from './FunctionTable';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  jest.restoreAllMocks();
});

const deployed: FunctionListItem = {
  name: 'func-demo-26',
  namespace: 'demo',
  runtime: 'go',
  status: 'Running',
  url: 'http://func-demo-26.demo.svc',
  replicas: 1,
};

describe('FunctionTable', () => {
  it('renders column headers', () => {
    render(
      <MemoryRouter>
        <FunctionTable functions={[deployed]} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('columnheader', { name: 'name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'runtime' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'status' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'url' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'replicas' })).toBeInTheDocument();
  });

  it('renders a row for each function', () => {
    const functions: FunctionListItem[] = [
      deployed,
      {
        name: 'issue-744-go-func',
        namespace: '',
        runtime: '',
        status: 'NotDeployed',
        replicas: 0,
      },
    ];

    render(
      <MemoryRouter>
        <FunctionTable functions={functions} />
      </MemoryRouter>,
    );

    const rows = screen.getAllByRole('row');
    // 1 header row + 2 data rows
    expect(rows).toHaveLength(3);
  });

  it('renders function name as a link to /functions/edit/:name', () => {
    render(
      <MemoryRouter>
        <FunctionTable functions={[deployed]} />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: 'func-demo-26' });
    expect(link).toHaveAttribute('href', '/functions/edit/func-demo-26');
  });

  it('renders shortened URL as clickable external link', () => {
    render(
      <MemoryRouter>
        <FunctionTable functions={[deployed]} />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: 'func-demo-26.demo.svc' });
    expect(link).toHaveAttribute('href', 'http://func-demo-26.demo.svc');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders a dash when url is not set', () => {
    const noUrl: FunctionListItem = {
      name: 'issue-744-go-func',
      namespace: '',
      runtime: '',
      status: 'NotDeployed',
      replicas: 0,
    };

    render(
      <MemoryRouter>
        <FunctionTable functions={[noUrl]} />
      </MemoryRouter>,
    );

    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('renders edit and delete action buttons per row', () => {
    render(
      <MemoryRouter>
        <FunctionTable functions={[deployed]} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'delete' })).toBeInTheDocument();
  });

  it('edit links to /functions/edit/:name', () => {
    render(
      <MemoryRouter>
        <FunctionTable functions={[deployed]} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'edit' })).toHaveAttribute(
      'href',
      '/functions/edit/func-demo-26',
    );
  });

  it('paginates at 20 items by default', () => {
    const functions: FunctionListItem[] = Array.from({ length: 25 }, (_, i) => ({
      name: `func-${i}`,
      namespace: 'demo',
      runtime: 'go',
      status: 'Running' as const,
      replicas: 1,
    }));

    render(
      <MemoryRouter>
        <FunctionTable functions={functions} />
      </MemoryRouter>,
    );

    // 1 header row + 20 data rows
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(21);
  });

  it('does not paginate when 20 or fewer items', () => {
    const functions: FunctionListItem[] = Array.from({ length: 5 }, (_, i) => ({
      name: `func-${i}`,
      namespace: 'demo',
      runtime: 'go',
      status: 'Running' as const,
      replicas: 1,
    }));

    render(
      <MemoryRouter>
        <FunctionTable functions={functions} />
      </MemoryRouter>,
    );

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(6);
    expect(screen.queryByLabelText(/pagination/i)).not.toBeInTheDocument();
  });
});
