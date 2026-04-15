'use client'

import { useEffect, useState } from 'react'
import { FolderKanban, Plus, Loader2, User } from 'lucide-react'

interface Project {
  id: string; title: string; description?: string
  manager?: { id: string; name: string }
  tasks: { id: string; stage: string }[]
}
interface Employee { id: string; name: string }

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', managerId: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    const [p, e] = await Promise.all([fetch('/api/projects').then(r => r.json()), fetch('/api/employees').then(r => r.json())])
    setProjects(Array.isArray(p) ? p : []); setEmployees(Array.isArray(e) ? e : []); setLoading(false)
  }
   
   
  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false); setShowModal(false); setForm({ title: '', description: '', managerId: '' }); load()
  }

  return (
    <div style={{ maxWidth: '1000px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-heading flex items-center gap-2.5">
            <FolderKanban size={24} strokeWidth={1.85} style={{ color: 'var(--accent)' }} /> Projects
          </h1>
          <p className="page-sub">{projects.length} active projects</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          <Plus size={15} /> New Project
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {[1,2,3].map(i => <div key={i} className="card" style={{ height: '140px' }} />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <FolderKanban size={32} style={{ color: 'var(--text-muted)', opacity: 0.3, margin: '0 auto 10px', display: 'block' }} />
          <p style={{ color: 'var(--text-muted)', marginBottom: '12px', fontSize: '13px' }}>No projects yet</p>
          <button onClick={() => setShowModal(true)} className="btn-primary" style={{ fontSize: '12px' }}>Create Project</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {projects.map((p, i) => {
            const done = p.tasks.filter(t => t.stage === 'DONE').length
            const pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0
            return (
              <div key={p.id} className="card animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div className="icon-box" style={{ width: '36px', height: '36px', background: 'var(--accent-gradient)' }}>
                    <FolderKanban size={17} color="white" />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '4px', fontWeight: '500' }}>{p.tasks.length} tasks</span>
                </div>
                <h3 style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px', letterSpacing: '-0.01em' }}>{p.title}</h3>
                {p.description && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: '1.5' }}>{p.description}</p>}
                {p.manager && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}><User size={12} /> {p.manager.name}</p>}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}><span>Progress</span><span>{done}/{p.tasks.length}</span></div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h2 className="font-display mb-5 text-lg font-semibold tracking-tight">Create project</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>Name *</label><input className="input" placeholder="e.g. Q2 Campaign" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
              <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>Description</label><textarea className="input" placeholder="What is this about?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
              <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>Manager</label><select className="input" value={form.managerId} onChange={e => setForm({ ...form, managerId: e.target.value })}><option value="">None</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ fontSize: '12px', padding: '8px 16px' }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ fontSize: '12px', padding: '8px 16px' }}>{saving ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
