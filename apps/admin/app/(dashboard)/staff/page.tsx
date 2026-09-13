'use client';

import { useEffect, useState } from 'react';
import type { StaffRole, StaffView } from '@ecommerce/shared-types';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { Select } from '../../../components/ui/Select';
import { ApiError } from '../../../lib/api/client';
import { staffApi, type CreateStaffPayload } from '../../../lib/api/staff.api';
import { useAuth } from '../../../lib/hooks/useAuth';

const ROLE_LABEL: Record<StaffRole, string> = {
  STAFF: 'Staff',
  SUPER_ADMIN: 'Super admin',
};

const EMPTY_FORM = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  role: 'STAFF' as StaffRole,
};

export default function StaffPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [items, setItems] = useState<StaffView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await staffApi.list();
        if (!cancelled) setItems(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load staff');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, reloadTick]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (!form.email.trim()) {
      setError('Enter an email address.');
      return;
    }
    if (form.password.length < 12) {
      setError('Staff passwords must be at least 12 characters.');
      return;
    }

    const payload: CreateStaffPayload = {
      email: form.email.trim(),
      password: form.password,
      role: form.role,
      firstName: form.firstName.trim() || undefined,
      lastName: form.lastName.trim() || undefined,
    };

    setSaving(true);
    try {
      await staffApi.create(payload);
      setForm(EMPTY_FORM);
      setFormOpen(false);
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the account');
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(member: StaffView, role: StaffRole) {
    setBusyId(member.id);
    setError('');
    try {
      await staffApi.update(member.id, { role });
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change the role');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleBlocked(member: StaffView) {
    setBusyId(member.id);
    setError('');
    try {
      await staffApi.update(member.id, { isBlocked: !member.isBlocked });
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the account');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(member: StaffView) {
    setBusyId(member.id);
    setError('');
    try {
      await staffApi.remove(member.id);
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove the account');
    } finally {
      setBusyId(null);
    }
  }

  // The API is the real boundary here: every /admin/staff route is
  // SUPER_ADMIN-only and returns 403 for staff. This just avoids showing a
  // staff member a page whose every action would fail.
  if (!isSuperAdmin) {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Staff</h1>
        <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary">
          Only super admins can manage staff accounts and roles.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Staff</h1>
          <p className="mt-1.5 text-xs text-text-secondary">
            {items.length} account{items.length === 1 ? '' : 's'} with admin access
          </p>
        </div>
        <Button type="button" onClick={() => setFormOpen((open) => !open)}>
          {formOpen ? 'Cancel' : 'Add staff account'}
        </Button>
      </div>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {formOpen ? (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-lg border border-border bg-background p-5 shadow-card"
          noValidate
        >
          <h2 className="mb-4 text-lg font-semibold text-text-primary">New staff account</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="staff-email"
              label="Email"
              type="email"
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
            <FormField
              id="staff-password"
              label="Temporary password (min 12 characters)"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            />
            <FormField
              id="staff-first"
              label="First name (optional)"
              value={form.firstName}
              onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
            />
            <FormField
              id="staff-last"
              label="Last name (optional)"
              value={form.lastName}
              onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
            />
            <Select
              id="staff-role"
              label="Role"
              value={form.role}
              onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as StaffRole }))}
            >
              <option value="STAFF">Staff — orders, inventory, customers</option>
              <option value="SUPER_ADMIN">Super admin — full access including settings</option>
            </Select>
          </div>

          <p className="mt-3 text-2xs text-text-secondary">
            Share the password over a separate channel and have them change it after signing in.
          </p>

          <div className="mt-5">
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create account'}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-surface text-2xs uppercase tracking-[0.1em] text-text-secondary">
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Added</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-text-secondary">
                    Loading staff…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-text-secondary">
                    No staff accounts yet.
                  </td>
                </tr>
              ) : (
                items.map((member) => {
                  const isSelf = member.id === user?.id;
                  const name = [member.firstName, member.lastName].filter(Boolean).join(' ');

                  return (
                    <tr key={member.id} className="border-b border-border last:border-0 hover:bg-surface">
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-text-primary">{name || member.email}</span>
                          {isSelf ? <Badge tone="accent">You</Badge> : null}
                        </div>
                        {name ? <div className="text-2xs text-text-secondary">{member.email}</div> : null}
                      </td>
                      <td className="px-4 py-3">
                        {isSelf ? (
                          // Self-demotion is refused by the API; showing a live
                          // select here would only offer an action that 400s.
                          <span className="text-sm text-text-secondary">{ROLE_LABEL[member.role]}</span>
                        ) : (
                          <select
                            value={member.role}
                            disabled={busyId === member.id}
                            onChange={(e) => changeRole(member, e.target.value as StaffRole)}
                            className="h-9 rounded border border-border bg-background px-2.5 text-xs text-text-primary outline-none focus:border-primary disabled:opacity-50"
                          >
                            <option value="STAFF">Staff</option>
                            <option value="SUPER_ADMIN">Super admin</option>
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={member.isBlocked ? 'danger' : 'success'}>
                          {member.isBlocked ? 'Blocked' : 'Active'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-2xs text-text-secondary">
                        {new Date(member.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        {isSelf ? (
                          <span className="text-xs text-text-secondary">—</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              disabled={busyId === member.id}
                              onClick={() => toggleBlocked(member)}
                              className="text-xs font-medium text-primary hover:text-primary-hover disabled:opacity-50"
                            >
                              {member.isBlocked ? 'Unblock' : 'Block'}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === member.id}
                              onClick={() => remove(member)}
                              className="text-xs text-danger hover:opacity-80 disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-2xs text-text-secondary">
        Removing an account that has placed orders blocks it instead of deleting it, so order history stays intact.
      </p>
    </div>
  );
}
