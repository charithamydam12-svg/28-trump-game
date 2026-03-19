import React, { useState } from 'react';
const GOLD = '#d4af37';

export default function BiddingScreen({
  gameState, myHand, playerId,
  onLosingTeamResponse, onPlaceBid, onPassBid, onPlaceBidJohn,
  onSelectTrump, onDeclareBlindTrump, onRespondMidgameJohn,
  isHost, onExitGame, onEndGame,
}) {
  const [customBid, setCustomBid] = useState('');
  const gs = gameState;

  if (!gs || !gs.players || !gs.bidding) {
    return <div style={{ minHeight: '100vh', background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4af37', fontSize: 20 }}>Loading...</div>;
  }

  const me = gs.players.find(p => p.id === playerId);
  const myTeam = me?.team;
  const bid = gs.bidding;
  const isMyTeamTurn = bid.biddingTeam === myTeam;
  const isMyTrumpTurn = gs.phase === 'TRUMP_SELECTION' && gs.trump.canPickTrump;
  const myTeamPassVotes = bid.teamPassVotes?.[myTeam] || [];
  const iHaveVotedPass = myTeamPassVotes.includes(playerId);
  // Only block re-bidding if it's currently my team's turn AND we already bid this turn
  const myTeamHasBid = isMyTeamTurn && bid.teamBids?.[myTeam] !== undefined;
  const johnActive = gs.john?.biddingJohnActive || false;
  const johnAlreadyCalled = !!(gs.john?.biddingJohnPlayerId);
  const isFirstBid = bid.isFirstBid;
  const losingTeam = bid.losingTeam;
  const maxBid = isFirstBid
    ? (bid.winningTeamBidFirst && myTeam === losingTeam ? 20 : 21)
    : bid.currentBid - 1;
  const canPass = isMyTeamTurn && !iHaveVotedPass;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'radial-gradient(ellipse at center, #0d2137 0%, #0a1628 70%)', padding: 24 }}>
      <div style={{ position: 'fixed', top: 52, right: 12, display: 'flex', gap: 8, zIndex: 999 }}>
        {isHost && <button onClick={onEndGame} style={topBtn('#c0392b')}>✕ End Game</button>}
        <button onClick={onExitGame} style={topBtn('#4a6a8a')}>🚪 Exit</button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 16, marginTop: 16 }}>
        <div style={{ color: GOLD, fontSize: 22, fontWeight: 'bold', letterSpacing: 2 }}>Game {gs.gameNumber}</div>
        <div style={{ color: '#6b8aaa', fontSize: 13, marginTop: 4 }}>A: {gs.matchScore.A} | B: {gs.matchScore.B} / 12</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ color: '#6b8aaa', fontSize: 12, textAlign: 'center', marginBottom: 8, letterSpacing: 1 }}>YOUR CARDS</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {myHand.slice(0, 4).map(card => <CardMini key={card.id} card={card} />)}
        </div>
      </div>

      {gs.phase === 'BIDDING' && (
        <PhaseBox title="Bidding Phase">
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ color: '#6b8aaa', fontSize: 13, marginBottom: 4 }}>Current Highest Bid</div>
            <div style={{ fontSize: 52, fontWeight: 'bold', color: johnActive ? '#f39c12' : GOLD, lineHeight: 1 }}>
              {bid.currentBid}
              {johnActive && <span style={{ fontSize: 18, marginLeft: 8 }}>🃏</span>}
            </div>
            {johnActive && (
              <div style={{ color: '#f39c12', fontSize: 12, marginTop: 4 }}>
                John by {gs.players.find(p => p.id === gs.john.biddingJohnPlayerId)?.name}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
            {['A', 'B'].map(team => {
              const isActive = bid.biddingTeam === team;
              const teamBid = bid.teamBids?.[team];
              const votes = bid.teamPassVotes?.[team] || [];
              const teamPlayers = gs.players.filter(p => p.team === team);
              const color = team === 'A' ? '#3498db' : '#e74c3c';
              return (
                <div key={team} style={{
                  flex: 1, background: isActive ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isActive ? GOLD : color}`, borderRadius: 12, padding: '12px', textAlign: 'center',
                }}>
                  <div style={{ color: isActive ? GOLD : color, fontWeight: 'bold', fontSize: 14, marginBottom: 6 }}>
                    Team {team} {isActive ? '⭐' : ''}
                  </div>
                  {teamBid !== undefined ? (
                    <div style={{ color: '#27ae60', fontWeight: 'bold', fontSize: 18 }}>Bid: {teamBid}</div>
                  ) : votes.length > 0 ? (
                    <div style={{ color: '#e74c3c', fontSize: 13 }}>
                      {votes.length === 2 ? '✗ Passed' : `${votes.length}/2 pass...`}
                    </div>
                  ) : (
                    <div style={{ color: '#4a6a8a', fontSize: 13 }}>{isActive ? '⏳ Bidding' : 'Waiting'}</div>
                  )}
                  <div style={{ marginTop: 6 }}>
                    {teamPlayers.map(p => (
                      <div key={p.id} style={{ fontSize: 11, color: '#6b8aaa', marginTop: 2 }}>
                        {p.name}{p.id === playerId ? ' (You)' : ''}{votes.includes(p.id) ? ' ✗' : ''}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {isMyTeamTurn && myTeamHasBid && (
            <WaitMsg>Your team bid {bid.teamBids[myTeam]} — waiting for opponent...</WaitMsg>
          )}

          {isMyTeamTurn && !myTeamHasBid && (
            <div>
              {johnActive && (
                <div style={{ background: 'rgba(243,156,18,0.15)', border: '1px solid #f39c12', borderRadius: 10, padding: '10px', marginBottom: 12, textAlign: 'center', color: '#f39c12', fontWeight: 'bold', fontSize: 13 }}>
                  🃏 JOHN active — bid to cancel, or Pass
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                <button onClick={() => onPlaceBid(maxBid)} style={{ ...quickBidBtn, fontSize: 20, padding: '12px 24px' }}>
                  Bid {maxBid}
                </button>
                {!johnAlreadyCalled && bid.currentBid > 16 && (
                  <ActionBtn color="#f39c12" textColor="#0a1628" onClick={onPlaceBidJohn}>🃏 John (16)</ActionBtn>
                )}
                {canPass && (
                  <ActionBtn color="#c0392b" onClick={onPassBid}>
                    {iHaveVotedPass ? '⏳ Waiting...' : 'Pass'}
                  </ActionBtn>
                )}
              </div>
              {iHaveVotedPass && (
                <div style={{ color: '#e74c3c', fontSize: 12, textAlign: 'center', marginBottom: 6 }}>
                  You passed — waiting for {gs.players.find(p => p.team === myTeam && p.id !== playerId)?.name}...
                </div>
              )}
              <div style={{ color: '#4a6a8a', fontSize: 11, textAlign: 'center' }}>
                {isFirstBid
                  ? `Max bid: ${maxBid}. Both players must pass to skip.`
                  : `Bid ${maxBid}, John (16), or both pass`}
              </div>
            </div>
          )}

          {!isMyTeamTurn && (
            <WaitMsg>Waiting for Team {bid.biddingTeam} to bid...</WaitMsg>
          )}
        </PhaseBox>
      )}

      {gs.phase === 'JOHN_OPTION' && (
        <JohnOptionPhase gs={gs} playerId={playerId} onRespondMidgameJohn={onRespondMidgameJohn} />
      )}

      {gs.phase === 'TRUMP_SELECTION' && (
        <PhaseBox title="Select Trump Card">
          {gs.bidding.forcedTrump && (
            <div style={{ background: 'rgba(192,57,43,0.2)', border: '1px solid #c0392b', borderRadius: 10, padding: '10px 20px', marginBottom: 20, color: '#e74c3c', textAlign: 'center', fontSize: 14 }}>
              ⚡ Forced! Team {gs.trump.trumpTeam} must pick trump!
            </div>
          )}
          {isMyTrumpTurn ? (
            <div>
              <div style={{ color: '#ccc', textAlign: 'center', marginBottom: 8, fontSize: 14 }}>
                {gs.bidding.forcedTrump ? 'Pick one card — first to pick wins!' : `You won at ${gs.bidding.targetBid}. Tap a card — its suit becomes secret trump.`}
              </div>
              <div style={{ color: '#6b8aaa', fontSize: 12, textAlign: 'center', marginBottom: 16 }}>Reserved — hidden until revealed in play</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                {myHand.slice(0, 4).map(card => (
                  <CardSelectable key={card.id} card={card} onClick={() => onSelectTrump(card.id)} />
                ))}
              </div>
              {gs.trump.canDeclareBlind && (
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <div style={{ color: '#6b8aaa', fontSize: 12, marginBottom: 8 }}>— OR —</div>
                  <ActionBtn color="#8e44ad" onClick={onDeclareBlindTrump}>🎴 Blind Middle Trump</ActionBtn>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ color: '#ccc', textAlign: 'center', marginBottom: 20, fontSize: 14 }}>
                {gs.bidding.forcedTrump
                  ? `Both Team ${gs.trump.trumpTeam} players can pick — first one wins!`
                  : `Waiting for ${gs.players.find(p => p.id === gs.trump.trumpPickerPlayerId)?.name} to pick trump...`}
              </div>
              <WaitMsg>🔒 Trump card is being selected secretly...</WaitMsg>
            </div>
          )}
        </PhaseBox>
      )}
    </div>
  );
}

function JohnOptionPhase({ gs, playerId, onRespondMidgameJohn }) {
  const johnTeam = gs.john?.midgameJohnTeam;
  const deciders = gs.john?.midgameJohnDeciders || [];
  const responses = gs.john?.midgameJohnResponses || {};
  const amDecider = deciders.includes(playerId);
  const myResponse = responses[playerId];
  return (
    <PhaseBox title="🃏 JOHN Option!">
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ color: '#f39c12', fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Team {johnTeam} won first 4 serves!</div>
        <div style={{ color: '#ccc', fontSize: 14, marginBottom: 6 }}>Call <b style={{ color: '#f39c12' }}>JOHN</b>?</div>
        <div style={{ color: '#7f8c8d', fontSize: 12 }}>Win all 3 → <b style={{ color: '#27ae60' }}>+2pts</b> | Lose any → opponent <b style={{ color: '#e74c3c' }}>+4pts</b></div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
        {deciders.map(pid => {
          const p = gs.players.find(pl => pl.id === pid);
          const resp = responses[pid];
          return (
            <div key={pid} style={{
              background: resp === true ? 'rgba(39,174,96,0.2)' : resp === false ? 'rgba(192,57,43,0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${resp === true ? '#27ae60' : resp === false ? '#c0392b' : '#555'}`,
              borderRadius: 10, padding: '8px 16px', textAlign: 'center',
            }}>
              <div style={{ color: '#ccc', fontSize: 13 }}>{p?.name}{pid === playerId ? ' (You)' : ''}</div>
              <div style={{ fontSize: 12, marginTop: 4, color: resp === true ? '#27ae60' : resp === false ? '#e74c3c' : '#4a6a8a' }}>
                {resp === true ? '✅ Accept' : resp === false ? '❌ Skip' : '⏳ Deciding...'}
              </div>
            </div>
          );
        })}
      </div>
      {amDecider && myResponse === undefined ? (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <ActionBtn color="#f39c12" textColor="#0a1628" onClick={() => onRespondMidgameJohn(true)}>🃏 Accept</ActionBtn>
          <ActionBtn color="#4a6a8a" onClick={() => onRespondMidgameJohn(false)}>Skip</ActionBtn>
        </div>
      ) : amDecider ? (
        <WaitMsg>Waiting for your teammate...</WaitMsg>
      ) : (
        <WaitMsg>Team {johnTeam} is deciding...</WaitMsg>
      )}
    </PhaseBox>
  );
}

function CardSelectable({ card, onClick }) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const [hov, setHov] = React.useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: 64, height: 88, background: '#fff', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        boxShadow: hov ? '0 0 0 3px #d4af37' : '0 4px 12px rgba(0,0,0,0.4)',
        transform: hov ? 'translateY(-6px)' : 'none', transition: 'all 0.15s',
        border: hov ? '2px solid #d4af37' : '2px solid transparent'
      }}>
      <div style={{ fontSize: 20, fontWeight: 'bold', color: isRed ? '#e74c3c' : '#1a1a2e', lineHeight: 1 }}>{card.rank}</div>
      <div style={{ fontSize: 22, color: isRed ? '#e74c3c' : '#1a1a2e' }}>{card.symbol}</div>
    </div>
  );
}

function PhaseBox({ title, children }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 20, padding: '24px 28px', width: '100%', maxWidth: 520 }}>
      <div style={{ color: '#d4af37', fontSize: 16, fontWeight: 'bold', letterSpacing: 2, textAlign: 'center', marginBottom: 20, textTransform: 'uppercase' }}>{title}</div>
      {children}
    </div>
  );
}

function WaitMsg({ children }) {
  return <div style={{ color: '#4a6a8a', textAlign: 'center', fontSize: 14, padding: '12px 0' }}>{children}</div>;
}

function ActionBtn({ children, onClick, color, textColor = '#fff' }) {
  return (
    <button onClick={onClick} style={{ padding: '12px 22px', borderRadius: 10, background: color, color: textColor, border: 'none', fontWeight: 'bold', fontSize: 15, cursor: 'pointer', fontFamily: 'Georgia,serif' }}>
      {children}
    </button>
  );
}

function CardMini({ card }) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  return (
    <div style={{ width: 52, height: 72, background: '#fff', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
      <div style={{ fontSize: 18, fontWeight: 'bold', color: isRed ? '#e74c3c' : '#1a1a2e', lineHeight: 1 }}>{card.rank}</div>
      <div style={{ fontSize: 18, color: isRed ? '#e74c3c' : '#1a1a2e' }}>{card.symbol}</div>
    </div>
  );
}

const quickBidBtn = { padding: '10px 16px', borderRadius: 8, background: 'rgba(212,175,55,0.15)', border: '1px solid #d4af37', color: '#d4af37', fontWeight: 'bold', fontSize: 16, cursor: 'pointer', fontFamily: 'Georgia,serif' };
const topBtn = (color) => ({ padding: '6px 14px', borderRadius: 8, border: 'none', background: color, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' });
