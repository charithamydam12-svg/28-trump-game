import React, { useEffect, useState } from 'react';
import { api } from '../api';

const GOLD = '#d4af37';

export default function LeaderboardScreen({ currentUserId, onBack }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.leaderboard()
      .then(({ players }) => setPlayers(players))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const medal = (rank) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at center, #0d2137 0%, #0a1628 70%)', padding: 'calc(env(safe-area-inset-top, 0px) + 24px) 24px 24px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <button onClick={onBack} style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', border: '1px solid #4a6a8a', color: '#8fa8c8', cursor: 'pointer', fontSize: 13 }}>← Back</button>
          <div style={{ color: GOLD, fontSize: 18, fontWeight: 'bold', letterSpacing: 2 }}>🏆 LEADERBOARD</div>
          <div style={{ width: 80 }} />
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(212,175,55,0.2)`, borderRadius: 16, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 50px 50px 50px 50px', gap: 6, padding: '12px 16px', background: 'rgba(212,175,55,0.1)', borderBottom: '1px solid rgba(212,175,55,0.2)', color: GOLD, fontSize: 11, fontWeight: 'bold', letterSpacing: 1 }}>
            <div>RANK</div>
            <div>PLAYER</div>
            <div style={{ textAlign: 'center' }}>🎮</div>
            <div style={{ textAlign: 'center' }}>✓</div>
            <div style={{ textAlign: 'center' }}>⭐</div>
            <div style={{ textAlign: 'center' }}>🏆</div>
          </div>

          {loading && <div style={{ padding: 32, textAlign: 'center', color: '#8fa8c8' }}>Loading...</div>}
          {err && <div style={{ padding: 24, color: '#e74c3c', textAlign: 'center' }}>{err}</div>}

          {!loading && players.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#8fa8c8' }}>No players yet — be the first!</div>
          )}

          {players.map((p, i) => {
            const isMe = p.id === currentUserId;
            const rank = i + 1;
            return (
              <div key={p.id} style={{
                display: 'grid', gridTemplateColumns: '50px 1fr 50px 50px 50px 50px', gap: 6,
                padding: '12px 16px', alignItems: 'center',
                background: isMe ? 'rgba(212,175,55,0.12)' : (i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent'),
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                borderLeft: isMe ? `3px solid ${GOLD}` : '3px solid transparent',
              }}>
                <div style={{ fontSize: 14, fontWeight: 'bold', color: rank <= 3 ? GOLD : '#8fa8c8' }}>
                  {medal(rank)}
                </div>
                <div>
                  <div style={{ color: isMe ? GOLD : '#fff', fontWeight: isMe ? 'bold' : 'normal', fontSize: 14 }}>
                    {p.name} {isMe && <span style={{ fontSize: 11, color: GOLD }}>(You)</span>}
                  </div>
                  <div style={{ color: '#6b8aaa', fontSize: 11 }}>@{p.username}</div>
                </div>
                <div style={{ textAlign: 'center', color: '#3498db', fontWeight: 'bold', fontSize: 14 }}>{p.games_played || 0}</div>
                <div style={{ textAlign: 'center', color: '#27ae60', fontWeight: 'bold', fontSize: 14 }}>{p.games_won || 0}</div>
                <div style={{ textAlign: 'center', color: GOLD, fontWeight: 'bold', fontSize: 14 }}>{p.mvp_count || 0}</div>
                <div style={{ textAlign: 'center', color: '#e74c3c', fontWeight: 'bold', fontSize: 14 }}>{p.series_won || 0}</div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: 10, color: '#6b8aaa', fontSize: 11, lineHeight: 1.7 }}>
          <div>🎮 Games Played &nbsp; ✓ Games Won &nbsp; ⭐ MVP &nbsp; 🏆 Series (12 pts)</div>
          <div style={{ marginTop: 4 }}>Ranked by: Series Won → Games Won → MVP → Games Played</div>
        </div>
      </div>
    </div>
  );
}
