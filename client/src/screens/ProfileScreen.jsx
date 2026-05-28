import React, { useState, useEffect } from 'react';
import { api, auth } from '../api';

const GOLD = '#d4af37';

export default function ProfileScreen({ user: initialUser, onUpdate, onBack, onLogout }) {
  const [user, setUser] = useState(initialUser);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: initialUser.name || '', username: initialUser.username || '',
    mobile: initialUser.mobile || '', password: '',
  });
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch fresh stats on mount
  useEffect(() => {
    api.me().then(({ user: fresh }) => {
      setUser(fresh);
      auth.updateUser(fresh);
      onUpdate(fresh);
      setForm(f => ({ ...f, name: fresh.name, username: fresh.username, mobile: fresh.mobile }));
    }).catch(() => { });
  }, []);

  const u = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    setErr(''); setMsg(''); setSaving(true);
    try {
      const body = { name: form.name, username: form.username, mobile: form.mobile };
      if (form.password) body.password = form.password;
      const { user: updated } = await api.updateProfile(body);
      auth.updateUser(updated);
      onUpdate(updated);
      setMsg('✓ Profile updated');
      setForm({ ...form, password: '' });
      setEditing(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at center, #0d2137 0%, #0a1628 70%)', padding: 24 }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <button onClick={onBack} style={backBtn}>← Back</button>
          <div style={{ color: GOLD, fontSize: 18, fontWeight: 'bold', letterSpacing: 2 }}>PROFILE</div>
          <button onClick={onLogout} style={{ ...backBtn, color: '#e74c3c', borderColor: '#c0392b' }}>Logout</button>
        </div>

        {/* Stats card */}
        <div style={{ background: 'rgba(212,175,55,0.08)', border: `1px solid rgba(212,175,55,0.25)`, borderRadius: 20, padding: '28px 24px', marginBottom: 20 }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: GOLD, color: '#0a1628', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 'bold', marginBottom: 10 }}>
              {(user.name || '?')[0].toUpperCase()}
            </div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}>{user.name}</div>
            <div style={{ color: '#8fa8c8', fontSize: 13 }}>@{user.username}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Stat label="Games Played" value={user.games_played} color="#3498db" />
            <Stat label="Games Won" value={user.games_won} color="#27ae60" />
            <Stat label="MVP Awards" value={user.mvp_count} color={GOLD} icon="⭐" />
            <Stat label="Series Won" value={user.series_won} color="#e74c3c" icon="🏆" />
          </div>
        </div>

        {/* Edit form */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(212,175,55,0.2)`, borderRadius: 20, padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ color: GOLD, fontSize: 14, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase' }}>Account Details</div>
            {!editing && (
              <button onClick={() => setEditing(true)} style={{ ...backBtn, fontSize: 12, padding: '6px 14px' }}>✎ Edit</button>
            )}
          </div>

          {editing ? (
            <>
              <Field label="Name" value={form.name} onChange={u('name')} />
              <Field label="Username" value={form.username} onChange={u('username')} />
              <Field label="Mobile" value={form.mobile} onChange={u('mobile')} type="tel" />
              <Field label="New Password (leave blank to keep)" value={form.password} onChange={u('password')} type="password" />
              {err && <div style={errBox}>⚠️ {err}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={save} disabled={saving} style={{ flex: 1, padding: '12px', borderRadius: 8, background: GOLD, color: '#0a1628', border: 'none', fontWeight: 'bold', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? '...' : 'Save'}
                </button>
                <button onClick={() => { setEditing(false); setErr(''); }} style={{ flex: 1, padding: '12px', borderRadius: 8, background: 'transparent', color: '#8fa8c8', border: '1px solid #4a6a8a', fontWeight: 'bold', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <Info label="Name" value={user.name} />
              <Info label="Username" value={`@${user.username}`} />
              <Info label="Mobile" value={user.mobile} />
              {msg && <div style={{ ...errBox, background: 'rgba(39,174,96,0.15)', borderColor: '#27ae60', color: '#27ae60' }}>{msg}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color, icon }) {
  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 'bold', color }}>{icon} {value || 0}</div>
      <div style={{ color: '#8fa8c8', fontSize: 11, marginTop: 4 }}>{label}</div>
    </div>
  );
}
function Info({ label, value }) {
  return (
    <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ color: '#8fa8c8', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#fff', fontSize: 15 }}>{value}</div>
    </div>
  );
}
function Field({ label, ...inputProps }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: '#8fa8c8', fontSize: 11, marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
      <input {...inputProps} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: `1px solid rgba(212,175,55,0.3)`, color: '#fff', fontSize: 15 }} />
    </div>
  );
}

const backBtn = { padding: '8px 16px', borderRadius: 8, background: 'transparent', border: `1px solid #4a6a8a`, color: '#8fa8c8', cursor: 'pointer', fontSize: 13 };
const errBox = { background: 'rgba(192,57,43,0.2)', border: '1px solid #c0392b', borderRadius: 8, padding: '10px 14px', color: '#e74c3c', fontSize: 13, marginBottom: 14 };
