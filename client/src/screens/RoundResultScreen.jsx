import React from 'react';
const GOLD = '#d4af37';

// ─────────────────────────────────────────────────────────────
// ROUND RESULT SCREEN
// ─────────────────────────────────────────────────────────────
export default function RoundResultScreen({ result, players, isHost, onNextRound, onExitGame, onEndGame }) {
  const {
    roundPoints, target, trumpTeam, opponentTeam,
    roundWinner, matchPointsAwarded, matchScore,
    isDraw, drawReason,
  } = result;

  const winnerColor = roundWinner === 'A' ? '#3498db' : '#e74c3c';

  // ── DRAW screen ──
  if (isDraw) {
    return (
      <div style={overlayStyle}>
        {/* Top-right exit buttons */}
        <div style={{ position: 'fixed', top: 12, right: 12, display: 'flex', gap: 8, zIndex: 999 }}>
          {isHost && (
            <button onClick={onEndGame} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#c0392b', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>✕ End Game</button>
          )}
          <button onClick={onExitGame} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#4a6a8a', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>🚪 Exit</button>
        </div>
        <div style={cardStyle}>
          <div style={{ color: GOLD, fontSize: 13, letterSpacing: 3, marginBottom: 8, textTransform: 'uppercase' }}>
            Round Over
          </div>
          <div style={{ fontSize: 36, fontWeight: 'bold', color: '#f39c12', marginBottom: 4 }}>
            🤝 Draw!
          </div>
          <div style={{ color: '#8fa8c8', marginBottom: 24, fontSize: 14 }}>
            Both teams get 0 match points
          </div>
          <div style={{
            background: 'rgba(243,156,18,0.1)', border: '1px solid rgba(243,156,18,0.3)',
            borderRadius: 12, padding: '14px 20px', marginBottom: 24, fontSize: 13, color: '#f39c12',
          }}>
            {drawReason}
          </div>

          {/* Match score */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 28, justifyContent: 'center' }}>
            <MatchPill team="A" score={matchScore.A} color="#3498db" />
            <div style={{ color: '#4a6a8a', alignSelf: 'center', fontWeight: 'bold' }}>/ 12</div>
            <MatchPill team="B" score={matchScore.B} color="#e74c3c" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            {isHost ? (
              <button onClick={onNextRound} style={goldBtn}>
                ▶ Start Next Round
              </button>
            ) : (
              <div style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, padding: '14px 28px', color: '#6b8aaa', fontSize: 14,
              }}>
                ⏳ Waiting for host to start next round...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle}>
      {/* Top-right exit buttons */}
      <div style={{ position: 'fixed', top: 12, right: 12, display: 'flex', gap: 8, zIndex: 999 }}>
        {isHost && (
          <button onClick={onEndGame} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#c0392b', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>✕ End Game</button>
        )}
        <button onClick={onExitGame} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#4a6a8a', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>🚪 Exit</button>
      </div>
      <div style={cardStyle}>
        <div style={{ color: GOLD, fontSize: 13, letterSpacing: 3, marginBottom: 8, textTransform: 'uppercase' }}>
          Round Over
        </div>
        <div style={{ fontSize: 36, fontWeight: 'bold', color: winnerColor, marginBottom: 4 }}>
          Team {roundWinner} Wins!
        </div>
        <div style={{ color: '#8fa8c8', marginBottom: 28, fontSize: 14 }}>
          +{matchPointsAwarded} match point{matchPointsAwarded > 1 ? 's' : ''}
          {result.isJohn && <span style={{ color: '#f39c12', marginLeft: 8 }}>🃏 John</span>}
        </div>

        {/* Points breakdown */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', borderRadius: 12,
          padding: '16px 24px', marginBottom: 20, width: '100%',
        }}>
          <Row label="Trump Team" value={`Team ${trumpTeam}`} />
          <Row label="Bid Target" value={target} highlight />
          <Row label="Team A Points" value={roundPoints.A} />
          <Row label="Team B Points" value={roundPoints.B} />
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 12, paddingTop: 12 }}>
            <Row label={`Team ${opponentTeam} needed`} value={`${target} points`} />
            <Row
              label="Result"
              value={roundPoints[opponentTeam] >= target ? '✅ Reached!' : '❌ Not reached'}
            />
          </div>
        </div>

        {/* Match score */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 28 }}>
          <MatchPill team="A" score={matchScore.A} color="#3498db" />
          <div style={{ color: '#4a6a8a', alignSelf: 'center', fontWeight: 'bold' }}>/ 12</div>
          <MatchPill team="B" score={matchScore.B} color="#e74c3c" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          {isHost ? (
            <button onClick={onNextRound} style={goldBtn}>
              ▶ Start Next Round
            </button>
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, padding: '14px 28px', color: '#6b8aaa', fontSize: 14,
            }}>
              ⏳ Waiting for host to start next round...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────
function Row({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
      <span style={{ color: '#6b8aaa', fontSize: 14 }}>{label}</span>
      <span style={{ color: highlight ? GOLD : '#fff', fontWeight: highlight ? 'bold' : 'normal', fontSize: 14 }}>
        {value}
      </span>
    </div>
  );
}

function MatchPill({ team, score, color, big }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: big ? 48 : 32, fontWeight: 'bold', color,
        lineHeight: 1,
      }}>
        {score}
      </div>
      <div style={{ color: '#6b8aaa', fontSize: 13, marginTop: 4 }}>Team {team}</div>
    </div>
  );
}

const overlayStyle = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(10,22,40,0.95)', padding: 24,
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
