import { assertPoolerCompatible } from './env.validation';

describe('assertPoolerCompatible', () => {
  it('rejects a transaction pooler URL without pgbouncer=true', () => {
    expect(() =>
      assertPoolerCompatible('postgresql://u:p@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'),
    ).toThrow(/pgbouncer=true/);
  });

  it('accepts a transaction pooler URL with pgbouncer=true', () => {
    expect(() =>
      assertPoolerCompatible(
        'postgresql://u:p@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5',
      ),
    ).not.toThrow();
  });

  it('accepts direct and session connections', () => {
    expect(() => assertPoolerCompatible('postgresql://u:p@localhost:5432/ecommerce?schema=public')).not.toThrow();
    expect(() =>
      assertPoolerCompatible('postgresql://u:p@aws-0-ap-south-1.pooler.supabase.com:5432/postgres'),
    ).not.toThrow();
  });
});
