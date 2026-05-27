import React, { useState } from 'react';

const GOLD = '#d4af37';
const DARK = '#0a1628';
const GREEN = '#1a4731';

export default function HomeScreen({ onCreateRoom, onJoinRoom, user, onProfile, onLeaderboard, onLogout }) {
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [name, setName] = useState(user?.name || '');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    if (mode === 'create') {
      await onCreateRoom(name.trim());
    } else {
      await onJoinRoom(roomCode.trim(), name.trim());
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: `radial-gradient(ellipse at center, #0d2137 0%, #0a1628 70%)`,
      padding: 24,
    }}>
      {/* User header */}
      {user && (
        <div style={{ position: 'fixed', top: 12, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', zIndex: 100 }}>
          <button onClick={onProfile} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.06)', border: `1px solid rgba(212,175,55,0.3)`,
            borderRadius: 30, padding: '6px 14px 6px 6px', cursor: 'pointer',
          }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: GOLD, color: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 14 }}>
              {(user.name || '?')[0].toUpperCase()}
            </div>
            <div style={{ color: GOLD, fontSize: 13, fontWeight: 'bold' }}>{user.name}</div>
          </button>
          <button onClick={onLeaderboard} style={{
            background: 'rgba(255,255,255,0.06)', border: `1px solid rgba(212,175,55,0.3)`,
            borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
            color: GOLD, fontSize: 13, fontWeight: 'bold',
          }}>
            🏆 Leaderboard
          </button>
        </div>
      )}

      {/* Background felt texture */}
      <div style={{
        position: 'fixed', inset: 0, opacity: 0.04,
        backgroundImage: `repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)`,
        backgroundSize: '8px 8px',
        pointerEvents: 'none',
      }} />

      {/* Card suits decoration */}
      <div style={{ position: 'fixed', top: 20, left: 30, fontSize: 80, opacity: 0.06, color: '#fff' }}>♠</div>
      <div style={{ position: 'fixed', top: 20, right: 30, fontSize: 80, opacity: 0.06, color: '#e74c3c' }}>♥</div>
      <div style={{ position: 'fixed', bottom: 20, left: 30, fontSize: 80, opacity: 0.06, color: '#e74c3c' }}>♦</div>
      <div style={{ position: 'fixed', bottom: 20, right: 30, fontSize: 80, opacity: 0.06, color: '#fff' }}>♣</div>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{
          fontSize: 72, fontWeight: 'bold', color: GOLD,
          textShadow: `0 0 40px rgba(212,175,55,0.4), 0 2px 0 rgba(0,0,0,0.5)`,
          letterSpacing: 4, lineHeight: 1,
        }}>
          28
        </div>
        <div style={{
          fontSize: 16, color: '#8fa8c8', letterSpacing: 6,
          textTransform: 'uppercase', marginTop: 4,
        }}>
          Trump Card Game
        </div>
        <div style={{
          width: 80, height: 2,
          background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
          margin: '16px auto 0',
        }} />
        <div style={{ color: '#6b8aaa', fontSize: 13, marginTop: 12, letterSpacing: 1 }}>
          Family Edition • 4 Players
        </div>
      </div>

      {/* Main card */}
      {!mode ? (
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(212,175,55,0.2)`,
          borderRadius: 20, padding: '40px 48px', width: '100%', maxWidth: 400,
          backdropFilter: 'blur(10px)',
        }}>
          <button
            onClick={() => setMode('create')}
            style={btnStyle(GOLD, '#0a1628')}
          >
            🏠 Create Room
          </button>
          <div style={{ height: 16 }} />
          <button
            onClick={() => setMode('join')}
            style={btnStyle('transparent', GOLD, `1px solid ${GOLD}`)}
          >
            🎴 Join Room
          </button>

          <div style={{ marginTop: 32, textAlign: 'center', color: '#4a6a8a', fontSize: 13 }}>
            Share the room code with your family<br />and start playing anywhere!
          </div>
        </div>
      ) : (
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(212,175,55,0.2)`,
          borderRadius: 20, padding: '40px 48px', width: '100%', maxWidth: 400,
          backdropFilter: 'blur(10px)',
        }}>
          <div style={{ color: GOLD, fontSize: 20, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' }}>
            {mode === 'create' ? '🏠 Create New Room' : '🎴 Join a Room'}
          </div>

          <label style={labelStyle}>Your Name</label>
          <input
            style={inputStyle}
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            maxLength={20}
            autoFocus
          />

          {mode === 'join' && (
            <>
              <label style={{ ...labelStyle, marginTop: 16 }}>Room Code</label>
              <input
                style={{ ...inputStyle, letterSpacing: 6, textAlign: 'center', fontSize: 24 }}
                placeholder="1234"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                maxLength={4}
                inputMode="numeric"
              />
            </>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim() || (mode === 'join' && !roomCode.trim())}
            style={{ ...btnStyle(GOLD, '#0a1628'), marginTop: 28, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Connecting...' : mode === 'create' ? 'Create Room →' : 'Join Room →'}
          </button>

          <button
            onClick={() => setMode(null)}
            style={{ ...btnStyle('transparent', '#8fa8c8'), marginTop: 12, fontSize: 14 }}
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}

const btnStyle = (bg, color, border = 'none') => ({
  width: '100%', padding: '15px 24px', borderRadius: 12,
  background: bg, color, border,
  fontSize: 16, fontWeight: 'bold', cursor: 'pointer',
  letterSpacing: 1, transition: 'all 0.2s',
  fontFamily: 'Georgia, serif',
});

const labelStyle = {
  display: 'block', color: '#8fa8c8', fontSize: 13,
  letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase',
};

const inputStyle = {
  width: '100%', padding: '14px 16px', borderRadius: 10,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(212,175,55,0.3)',
  color: '#fff', fontSize: 16, fontFamily: 'Georgia, serif',
  outline: 'none',
};
