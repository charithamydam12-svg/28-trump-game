import React, { useState } from 'react';
import { api, auth } from '../api';

const GOLD = '#d4af37';

export default function AuthScreen({ onLoggedIn }) {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [form, setForm] = useState({ name:'', username:'', mobile:'', password:'', login:'' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    setErr(''); setLoading(true);
    try {
      if (mode === 'signup') {
        if (!form.name || !form.username || !form.mobile || !form.password)
          throw new Error('Please fill all fields');
        const { token, user } = await api.signup({
          name: form.name.trim(), username: form.username.trim(),
          mobile: form.mobile.trim(), password: form.password,
        });
        auth.save(token, user);
        onLoggedIn(user);
      } else {
        if (!form.login || !form.password) throw new Error('Enter login & password');
        const { token, user } = await api.login({
          login: form.login.trim(), password: form.password,
        });
        auth.save(token, user);
        onLoggedIn(user);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', background:'radial-gradient(ellipse at center, #0d2137 0%, #0a1628 70%)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:48, fontWeight:'bold', color:GOLD, letterSpacing:2 }}>28</div>
          <div style={{ color:'#8fa8c8', fontSize:14, letterSpacing:4, marginTop:4 }}>TRUMP CARD GAME</div>
        </div>

        <div style={{ background:'rgba(255,255,255,0.04)', border:`1px solid rgba(212,175,55,0.2)`, borderRadius:20, padding:'28px 24px' }}>
          {/* Tabs */}
          <div style={{ display:'flex', gap:0, marginBottom:24, background:'rgba(0,0,0,0.3)', borderRadius:10, padding:4 }}>
            {['login', 'signup'].map(m => (
              <button key={m} onClick={() => { setMode(m); setErr(''); }} style={{
                flex:1, padding:'10px', borderRadius:8, border:'none',
                background: mode === m ? GOLD : 'transparent',
                color: mode === m ? '#0a1628' : '#8fa8c8',
                fontWeight:'bold', cursor:'pointer', fontSize:14, textTransform:'capitalize',
              }}>{m}</button>
            ))}
          </div>

          {mode === 'signup' ? (
            <>
              <Field label="Full Name"   value={form.name}     onChange={update('name')}     placeholder="Your name" />
              <Field label="Username"    value={form.username} onChange={update('username')} placeholder="Choose unique username" />
              <Field label="Mobile"      value={form.mobile}   onChange={update('mobile')}   placeholder="10-digit mobile" type="tel" />
              <Field label="Password"    value={form.password} onChange={update('password')} placeholder="Min 4 characters" type="password" />
            </>
          ) : (
            <>
              <Field label="Username or Mobile" value={form.login}    onChange={update('login')}    placeholder="Enter username or mobile" />
              <Field label="Password"           value={form.password} onChange={update('password')} placeholder="Your password" type="password" />
            </>
          )}

          {err && (
            <div style={{ background:'rgba(192,57,43,0.2)', border:'1px solid #c0392b', borderRadius:8, padding:'10px 14px', color:'#e74c3c', fontSize:13, marginBottom:16 }}>
              ⚠️ {err}
            </div>
          )}

          <button onClick={submit} disabled={loading} style={{
            width:'100%', padding:'14px', borderRadius:10, background:GOLD, color:'#0a1628',
            border:'none', fontWeight:'bold', fontSize:16, cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1, letterSpacing:1, fontFamily:'Georgia, serif',
          }}>
            {loading ? '...' : (mode === 'signup' ? 'Create Account' : 'Login')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, ...inputProps }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ color:'#8fa8c8', fontSize:11, marginBottom:6, letterSpacing:1, textTransform:'uppercase' }}>{label}</div>
      <input {...inputProps} style={{
        width:'100%', padding:'12px 14px', borderRadius:8,
        background:'rgba(255,255,255,0.06)', border:`1px solid rgba(212,175,55,0.3)`,
        color:'#fff', fontSize:15, fontFamily:'Georgia, serif',
      }} />
    </div>
  );
}
