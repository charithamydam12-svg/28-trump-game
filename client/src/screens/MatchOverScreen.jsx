import React from 'react';

const GOLD = '#d4af37';

export default function MatchOverScreen({ matchScore, players, onNewGame }) {
  const winner = matchScore.A >= 12 ? 'A' : 'B';
  const winnerColor = winner === 'A' ? '#3498db' : '#e74c3c';
  const winnerPlayers = players.filter((p) => p.team === winner);

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>

        <div style={{ color: GOLD, fontSize: 13, letterSpacing: 3, marginBottom: 8, textTransform: 'uppercase' }}>
          Match Complete
        </div>

        <div style={{ fontSize: 40, fontWeight: 'bold', color: winnerColor, marginBottom: 8 }}>
          Team {winner} Wins!
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 28, justifyContent: 'center', flexWrap: 'wrap' }}>
          {winnerPlayers.map((p) => (
            <div key={p.id} style={{
              background: `rgba(${winner === 'A' ? '52,152,219' : '231,76,60'},0.2)`,
              border: `1px solid ${winnerColor}`, borderRadius: 20,
              padding: '6px 16px', color: winnerColor, fontWeight: 'bold',
            }}>
              🎉 {p.name}
            </div>
          ))}
        </div>

        {/* Final score */}
        <div style={{
          display: 'flex', gap: 20, marginBottom: 32, alignItems: 'center',
          background: 'rgba(255,255,255,0.04)', borderRadius: 16,
          padding: '20px 32px',
        }}>
          <ScorePill team="A" score={matchScore.A} color="#3498db" />
          <div style={{ color: '#4a6a8a', fontSize: 24, fontWeight: 'bold' }}>:</div>
          <ScorePill team="B" score={matchScore.B} color="#e74c3c" />
        </div>

        <button onClick={onNewGame} style={goldBtn}>
          🔄 Play Again
        </button>
      </div>
    </div>
  );
}

function ScorePill({ team, score, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 48, fontWeight: 'bold', color, lineHeight: 1 }}>{score}</div>
      <div style={{ color: '#6b8aaa', fontSize: 13, marginTop: 4 }}>Team {team}</div>
    </div>
  );
}

const overlayStyle = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(10,22,40,0.98)', padding: 24,
};

const cardStyle = {
  background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(212,175,55,0.3)`,
  borderRadius: 24, padding: '40px 40px', maxWidth: 440, width: '100%',
  textAlign: 'center', backdropFilter: 'blur(20px)',
};

const goldBtn = {
  padding: '14px 40px', borderRadius: 12, background: GOLD,
  color: '#0a1628', border: 'none', fontSize: 16, fontWeight: 'bold',
  cursor: 'pointer', letterSpacing: 1, fontFamily: 'Georgia, serif',
};
