import React from 'react';

const GOLD = '#d4af37';
const TEAM_A = '#3498db';
const TEAM_B = '#e74c3c';

export default function LobbyScreen({ lobby, playerId, onSwapTeam, onStartGame }) {
  const { roomId, hostId, players, canStart } = lobby;
  const isHost = playerId === hostId;

  const teamA = players.filter((p) => p.team === 'A');
  const teamB = players.filter((p) => p.team === 'B');

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: `radial-gradient(ellipse at center, #0d2137 0%, #0a1628 70%)`,
      padding: 24,
    }}>
      {/* Room code */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ color: '#6b8aaa', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' }}>
          Room Code
        </div>
        <div style={{
          fontSize: 48, fontWeight: 'bold', color: GOLD, letterSpacing: 12,
          textShadow: `0 0 20px rgba(212,175,55,0.4)`,
          background: 'rgba(212,175,55,0.1)', border: `2px dashed ${GOLD}`,
          padding: '12px 32px', borderRadius: 16, marginTop: 8,
        }}>
          {roomId}
        </div>
        <div style={{ color: '#4a6a8a', fontSize: 13, marginTop: 10 }}>
          Share this code with your family members
        </div>
      </div>

      {/* Teams grid */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 32, width: '100%', maxWidth: 520 }}>
        <TeamColumn team="A" players={teamA} color={TEAM_A} label="Team A" />
        <div style={{ display: 'flex', alignItems: 'center', color: '#4a6a8a', fontWeight: 'bold', fontSize: 18 }}>
          VS
        </div>
        <TeamColumn team="B" players={teamB} color={TEAM_B} label="Team B" />
      </div>

      {/* Waiting indicator */}
      {players.length < 4 && (
        <div style={{
          color: '#6b8aaa', fontSize: 14, marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ animation: 'pulse 1.5s infinite' }}>⏳</span>
          Waiting for {4 - players.length} more player{players.length !== 3 ? 's' : ''}...
        </div>
      )}

      {/* Player actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320 }}>
        <button
          onClick={onSwapTeam}
          style={outlineBtn}
        >
          ⇄ Switch Team
        </button>

        {isHost && (
          <button
            onClick={onStartGame}
            disabled={!canStart}
            style={{
              ...solidBtn,
              opacity: canStart ? 1 : 0.4,
              cursor: canStart ? 'pointer' : 'not-allowed',
            }}
          >
            {canStart ? '🎮 Start Game' : `Need ${4 - players.length} more player(s)`}
          </button>
        )}

        {!isHost && (
          <div style={{ textAlign: 'center', color: '#4a6a8a', fontSize: 14 }}>
            Waiting for host to start the game...
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
      `}</style>
    </div>
  );
}

function TeamColumn({ team, players, color, label }) {
  const slots = [0, 1];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        textAlign: 'center', color, fontWeight: 'bold',
        fontSize: 18, letterSpacing: 2, textTransform: 'uppercase',
        borderBottom: `2px solid ${color}`, paddingBottom: 10,
      }}>
        {label}
      </div>
      {slots.map((i) => {
        const player = players[i];
        return (
          <div
            key={i}
            style={{
              background: player ? `rgba(${team === 'A' ? '52,152,219' : '231,76,60'},0.1)` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${player ? color : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 12, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}
          >
            {player ? (
              <>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: color, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontWeight: 'bold', fontSize: 16,
                  color: '#fff', flexShrink: 0,
                }}>
                  {player.name[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{player.name}</div>
                  <div style={{ color: '#6b8aaa', fontSize: 12 }}>Position {player.position + 1}</div>
                </div>
              </>
            ) : (
              <div style={{ color: '#3a5a7a', fontSize: 14, width: '100%', textAlign: 'center' }}>
                Waiting...
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const solidBtn = {
  padding: '15px 24px', borderRadius: 12,
  background: '#d4af37', color: '#0a1628',
  border: 'none', fontSize: 16, fontWeight: 'bold',
  cursor: 'pointer', fontFamily: 'Georgia, serif', letterSpacing: 1,
};

const outlineBtn = {
  padding: '14px 24px', borderRadius: 12,
  background: 'transparent', color: '#d4af37',
  border: '1px solid #d4af37', fontSize: 16, fontWeight: 'bold',
  cursor: 'pointer', fontFamily: 'Georgia, serif',
};
