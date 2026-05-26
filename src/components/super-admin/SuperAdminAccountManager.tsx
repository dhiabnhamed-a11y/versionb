'use client'

import { useDeferredValue, useEffect, useState } from 'react'
import { Loader2, Search, Trash2, ShieldCheck, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react'

type UserRecord = {
  id: string
  name: string
  email: string
  role: string
  accountStatus: string
  createdAt: string
  companyId: string | null
  company: { name: string; status: string } | null
}

type UserResponse = {
  users: UserRecord[]
  error?: string
}

export default function SuperAdminAccountManager() {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [users, setUsers] = useState<UserRecord[]>([])
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [confirmationCode, setConfirmationCode] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    let active = true

    async function loadUsers() {
      setLoading(true)
      setError('')

      const response = await fetch(
        `/api/super-admin/users?query=${encodeURIComponent(deferredSearch)}`,
        { cache: 'no-store' }
      )
      const payload = (await response.json()) as UserResponse

      if (!active) return

      if (!response.ok) {
        setError(payload.error || 'Failed to load users.')
        setLoading(false)
        return
      }

      setUsers(payload.users)
      setLoading(false)
    }

    void loadUsers()

    return () => { active = false }
  }, [deferredSearch])

  async function handleDelete(userId: string) {
    if (confirmationCode !== '11193708') {
      setDeleteError('Enter the correct confirmation code to delete.')
      return
    }

    setDeletingUserId(userId)
    setDeleteError('')
    setSuccessMsg('')

    const response = await fetch('/api/super-admin/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, confirmationCode }),
    })
    const payload = (await response.json()) as { error?: string; success?: boolean; deletedUser?: { name: string; email: string } }

    setDeletingUserId(null)

    if (!response.ok) {
      setDeleteError(payload.error || 'Failed to delete account.')
      return
    }

    setUsers((prev) => prev.filter((u) => u.id !== userId))
    setConfirmationCode('')
    setSuccessMsg(`Account "${payload.deletedUser?.name ?? userId}" has been permanently deleted.`)
  }

  function getRoleBadge(role: string) {
    if (role === 'SUPER_ADMIN') return { bg: '#fef2f2', color: '#991b1b', label: 'Super Admin' }
    if (role === 'OWNER') return { bg: '#eff6ff', color: '#1d4ed8', label: 'Owner' }
    if (role === 'MANAGER') return { bg: '#f0fdf4', color: '#166534', label: 'Manager' }
    return { bg: '#f8fafc', color: '#475569', label: 'Employee' }
  }

  function getStatusBadge(status: string) {
    if (status === 'ACTIVE') return { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' }
    if (status === 'DISABLED') return { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' }
    return { bg: '#fffbeb', color: '#92400e', border: '#fde68a' }
  }

  const containerStyle: React.CSSProperties = {
    padding: '24px',
    maxWidth: '1200px',
  }

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    overflow: 'hidden',
  }

  const headerStyle: React.CSSProperties = {
    padding: '20px 24px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
  }

  const searchWrapStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '8px 12px',
    flex: '1 1 320px',
    maxWidth: '400px',
  }

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  }

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '10px 16px',
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc',
  }

  const tdStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: '1px solid #f1f5f9',
    color: '#334155',
  }

  const dangerBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#dc2626',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  }

  return (
    <div style={containerStyle}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
          <ShieldCheck size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
          Super Admin
        </div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Account Deletion</h1>
        <p style={{ fontSize: '13px', color: '#64748b' }}>
          Search and permanently delete user accounts. Deleting an account removes all associated data including company records.
          This action requires a confirmation code and cannot be undone.
        </p>
      </div>

      {successMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', marginBottom: '16px' }}>
          <CheckCircle2 size={16} />
          {successMsg}
        </div>
      )}

      {deleteError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', marginBottom: '16px' }}>
          <AlertTriangle size={16} />
          {deleteError}
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', marginBottom: '16px' }}>
          <XCircle size={16} />
          {error}
        </div>
      )}

      <div style={cardStyle}>
        <div style={headerStyle}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>All Accounts</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{users.length} user{users.length !== 1 ? 's' : ''} found</div>
          </div>
          <label style={searchWrapStyle}>
            <Search size={15} color="#64748b" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              style={{ border: 'none', outline: 'none', flex: 1, minWidth: 0, fontSize: '13px', fontFamily: 'inherit' }}
            />
          </label>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>User</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Company</th>
                <th style={thStyle}>Joined</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', padding: '40px 16px' }}>
                    <Loader2 size={18} className="animate-spin" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                    <span>Loading accounts...</span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', padding: '40px 16px', color: '#94a3b8' }}>
                    No accounts matched this search.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const roleBadge = getRoleBadge(user.role)
                  const statusBadge = getStatusBadge(user.accountStatus)
                  const isDeleting = deletingUserId === user.id
                  return (
                    <tr key={user.id}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{user.name}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: roleBadge.bg, color: roleBadge.color }}>
                          {roleBadge.label}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '999px', border: `1px solid ${statusBadge.border}`, background: statusBadge.bg, color: statusBadge.color, fontSize: '11px', fontWeight: 700 }}>
                          {user.accountStatus}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontSize: '13px', color: '#334155' }}>{user.company?.name ?? '-'}</div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmationCode('')
                            setDeleteError('')
                            setSuccessMsg('')
                            const code = window.prompt('⚠️ PERMANENT DELETION\n\nEnter the confirmation code 11193708 to delete this account:')
                            if (code === '11193708') {
                              void handleDelete(user.id)
                            } else if (code !== null) {
                              setDeleteError('Invalid confirmation code. Deletion cancelled.')
                            }
                          }}
                          disabled={isDeleting || user.role === 'SUPER_ADMIN'}
                          style={{
                            ...dangerBtnStyle,
                            opacity: (isDeleting || user.role === 'SUPER_ADMIN') ? 0.5 : 1,
                            cursor: (isDeleting || user.role === 'SUPER_ADMIN') ? 'not-allowed' : 'pointer',
                          }}
                          title={user.role === 'SUPER_ADMIN' ? 'Cannot delete super admin accounts' : `Delete ${user.name}'s account`}
                        >
                          {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: '24px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '16px', fontSize: '13px', color: '#92400e' }}>
        <strong>⚠️ Irreversible Action:</strong> Account deletion permanently removes the user and all associated data
        (company, projects, tasks, invoices, etc.) from both the website and database. A confirmation code is required for every deletion.
      </div>
    </div>
  )
}
