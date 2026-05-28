import React from 'react';
const GOLD = '#d4af37';

export default function RoundResultScreen({ result, players, isHost, onNextRound, onExitGame, onEndGame }) {
  const {
    roundPoints, target, trumpTeam, opponentTeam,
    roundWinner, matchPointsAwarded, matchScore,
    isDraw, drawReason, mvp,
  } = result;

  // Helper: get "Name1 & Name2" for a team
  const teamNames = (team) => {
    const teamPlayers = (players || []).filter(p => p.team === team);
    if (teamPlayers.length === 0) return `Team ${team}`;
    return teamPlayers.map(p => p.name).join(' & ');
  };

  const teamANames = teamNames('A');
  const teamBNames = teamNames('B');
  const winnerColor = roundWinner === 'A' ? '#3498db' : '#e74c3c';
  const winnerNames = roundWinner ? teamNames(roundWinner) : '';

  const ExitButtons = () => (
    <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', right: 12, display: 'flex', gap: 8, zIndex: 999 }}>
      {isHost && (
        <button onClick={onEndGame} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#c0392b', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>✕ End Game</button>
      )}
      <button onClick={onExitGame} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#4a6a8a', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>🚪 Exit</button>
    </div>
  );

  const NextButton = () => isHost ? (
    <button onClick={onNextRound} style={goldBtn}>▶ Start Next Round</button>
  ) : (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 28px', color: '#6b8aaa', fontSize: 14 }}>
      ⏳ Waiting for host to start next round...
    </div>
  );

  const MvpBadge = () => mvp ? (
    <div style={{
      background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.35)',
      borderRadius: 14, padding: '14px 20px', marginBottom: 16, textAlign: 'center',
    }}>
      <div style={{ color: '#d4af37', fontSize: 11, letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase' }}>⭐ MVP of the Round</div>
      <div style={{ fontSize: 22, fontWeight: 'bold', color: mvp.team === 'A' ? '#3498db' : '#e74c3c' }}>
        {mvp.name}
      </div>
      <div style={{ color: '#8fa8c8', fontSize: 13, marginTop: 4 }}>
        {mvp.points} points earned this round
      </div>
    </div>
  ) : null;

  // ── DRAW ──
  if (isDraw) {
    return (
      <div style={overlayStyle}>
        <ExitButtons />
        <div style={cardStyle}>
          <div style={{ color: GOLD, fontSize: 13, letterSpacing: 3, marginBottom: 8, textTransform: 'uppercase' }}>Round Over</div>
          <div style={{ fontSize: 36, fontWeight: 'bold', color: '#f39c12', marginBottom: 4 }}>🤝 Draw!</div>
          <div style={{ color: '#8fa8c8', marginBottom: 20, fontSize: 14 }}>Both teams get 0 match points</div>
          <div style={{ background: 'rgba(243,156,18,0.1)', border: '1px solid rgba(243,156,18,0.3)', borderRadius: 12, padding: '14px 20px', marginBottom: 24, fontSize: 13, color: '#f39c12' }}>
            {drawReason}
          </div>
          <div style={{ display: 'flex', gap: 24, marginBottom: 28, justifyContent: 'center' }}>
            <MatchPill label={teamANames} score={matchScore.A} color="#3498db" />
            <div style={{ color: '#4a6a8a', alignSelf: 'center', fontWeight: 'bold' }}>/ 12</div>
            <MatchPill label={teamBNames} score={matchScore.B} color="#e74c3c" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <MvpBadge />
            <NextButton />
          </div>
        </div>
      </div>
    );
  }

  // ── NORMAL RESULT ──
  return (
    <div style={overlayStyle}>
      <ExitButtons />
      <div style={cardStyle}>
        <div style={{ color: GOLD, fontSize: 13, letterSpacing: 3, marginBottom: 8, textTransform: 'uppercase' }}>Round Over</div>
        <div style={{ fontSize: 28, fontWeight: 'bold', color: winnerColor, marginBottom: 4 }}>
          {winnerNames} Win!
        </div>
        <div style={{ color: '#8fa8c8', marginBottom: 20, fontSize: 14 }}>
          +{matchPointsAwarded} match point{matchPointsAwarded > 1 ? 's' : ''}
          {result.isJohn && <span style={{ color: '#f39c12', marginLeft: 8 }}>🃏 John</span>}
        </div>

        {/* Points breakdown — ordered as requested */}
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '16px 20px', marginBottom: 20, width: '100%' }}>

          {/* Trump Team */}
          <Row label="Trump Team" value={teamNames(trumpTeam)} />

          {/* Team A points — green */}
          <Row label={`${teamANames} points`} value={roundPoints.A} color="#27ae60" />

          {/* Team B points — red */}
          <Row label={`${teamBNames} points`} value={roundPoints.B} color="#e74c3c" />

          {/* Bid Target */}
          <Row label="Bid Target" value={target} highlight />

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 12, paddingTop: 12 }}>
            {/* Which team needed to reach target */}
            <Row label={`${teamNames(opponentTeam)} needed`} value={`${target} points`} />
            <Row label="Result" value={roundPoints[opponentTeam] >= target ? '✅ Reached!' : '❌ Not reached'} />
          </div>
        </div>

        {/* Match score with names */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 28, justifyContent: 'center', flexWrap: 'wrap' }}>
          <MatchPill label={teamANames} score={matchScore.A} color="#3498db" />
          <div style={{ color: '#4a6a8a', alignSelf: 'center', fontWeight: 'bold', fontSize: 18 }}>/ 12</div>
          <MatchPill label={teamBNames} score={matchScore.B} color="#e74c3c" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <MvpBadge />
          <NextButton />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
      <span style={{ color: '#6b8aaa', fontSize: 13 }}>{label}</span>
      <span style={{ color: color || (highlight ? GOLD : '#fff'), fontWeight: highlight ? 'bold' : 'normal', fontSize: 13 }}>
        {value}
      </span>
    </div>
  );
}

function MatchPill({ label, score, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 32, fontWeight: 'bold', color, lineHeight: 1 }}>{score}</div>
      <div style={{ color: '#6b8aaa', fontSize: 11, marginTop: 4, maxWidth: 120 }}>{label}</div>
    </div>
  );
}

const overlayStyle = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(10,22,40,0.95)', padding: 24,
};

const cardStyle = {
  background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(212,175,55,0.3)`,
  borderRadius: 24, padding: '32px 28px', maxWidth: 460, width: '100%',
  textAlign: 'center', backdropFilter: 'blur(20px)',
};

const goldBtn = {
  padding: '14px 40px', borderRadius: 12, background: GOLD,
  color: '#0a1628', border: 'none', fontSize: 16, fontWeight: 'bold',
  cursor: 'pointer', letterSpacing: 1, fontFamily: 'Georgia, serif',
};
