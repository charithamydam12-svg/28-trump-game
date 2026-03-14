import React, { useState } from 'react';

const GOLD = '#d4af37';

export default function BiddingScreen({
  gameState, myHand, playerId,
  onLosingTeamResponse, onPlaceBid, onPassBid, onPlaceBidJohn,
  onSelectTrump, onDeclareBlindTrump, onRespondMidgameJohn,
}) {
  const [customBid, setCustomBid] = useState('');
  const gs = gameState;

  if (!gs || !gs.players || !gs.bidding) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a1628', display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: '#d4af37', fontSize: 20
      }}>
        Loading...
      </div>
    );
  }

  const me = gs.players.find(p => p.id === playerId);
  const myTeam = me?.team;
  const isMyBidTurn = gs.phase === 'BIDDING' && gs.bidding.currentBidderPlayerId === playerId;
  const isMyLosingTeam = gs.phase === 'ASK_LOSING_TEAM' && gs.losingTeam === myTeam;
  const isMyTrumpTurn = gs.phase === 'TRUMP_SELECTION' && gs.trump.canPickTrump;
  const iHavePassed = gs.bidding.passedPlayers?.includes(playerId);
  const johnActive = gs.john?.biddingJohnActive || false;
  const johnAlreadyCalled = !!(gs.john?.biddingJohnPlayerId);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'radial-gradient(ellipse at center, #0d2137 0%, #0a1628 70%)',
      padding: 24,
    }}>
      <div style={{ textAlign: 'center', marginBottom: 20, marginTop: 16 }}>
        <div style={{ color: GOLD, fontSize: 22, fontWeight: 'bold', letterSpacing: 2 }}>Game {gs.gameNumber}</div>
        <div style={{ color: '#6b8aaa', fontSize: 13, marginTop: 4 }}>
          Match Score — A: {gs.matchScore.A} | B: {gs.matchScore.B} / 12
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ color: '#6b8aaa', fontSize: 12, textAlign: 'center', marginBottom: 10, letterSpacing: 1 }}>YOUR CARDS (First 4)</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {myHand.slice(0, 4).map(card => <CardMini key={card.id} card={card} />)}
        </div>
      </div>

      {gs.phase === 'ASK_LOSING_TEAM' && (
        <PhaseBox title="Trump Decision">
          <div style={{ color: '#ccc', marginBottom: 16, textAlign: 'center', lineHeight: 1.7 }}>
            Team <b style={{ color: '#e74c3c' }}>{gs.losingTeam}</b> is losing. Do you want to bid?
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
            {gs.players.filter(p => p.team === gs.losingTeam).map(p => {
              const resp = gs.losingTeamResponses?.[p.id];
              return (
                <div key={p.id} style={{
                  background: resp === true ? 'rgba(39,174,96,0.2)' : resp === false ? 'rgba(192,57,43,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${resp === true ? '#27ae60' : resp === false ? '#c0392b' : '#333'}`,
                  borderRadius: 10, padding: '8px 16px', textAlign: 'center',
                }}>
                  <div style={{ color: '#ccc', fontSize: 13 }}>{p.name}{p.id === playerId ? ' (You)' : ''}</div>
                  <div style={{ fontSize: 12, marginTop: 4, color: resp === true ? '#27ae60' : resp === false ? '#e74c3c' : '#4a6a8a' }}>
                    {resp === true ? '✅ Wants to bid' : resp === false ? '❌ Pass' : '⏳ Deciding...'}
                  </div>
                </div>
              );
            })}
          </div>
          {isMyLosingTeam && gs.losingTeamResponses?.[playerId] === undefined ? (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <ActionBtn color="#27ae60" onClick={() => onLosingTeamResponse(true)}>✅ Yes, Bid</ActionBtn>
              <ActionBtn color="#c0392b" onClick={() => onLosingTeamResponse(false)}>❌ No, Pass</ActionBtn>
            </div>
          ) : isMyLosingTeam ? (
            <WaitMsg>Waiting for your teammate...</WaitMsg>
          ) : (
            <WaitMsg>Waiting for Team {gs.losingTeam} to decide...</WaitMsg>
          )}
        </PhaseBox>
      )}

      {gs.phase === 'BIDDING' && (
        <PhaseBox title="Bidding Phase">
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ color: '#6b8aaa', fontSize: 13, marginBottom: 4 }}>Current Highest Bid</div>
            <div style={{ fontSize: 52, fontWeight: 'bold', color: johnActive ? '#f39c12' : GOLD, lineHeight: 1 }}>
              {gs.bidding.currentBid}
              {johnActive && <span style={{ fontSize: 18, marginLeft: 8 }}>🃏</span>}
            </div>
            {johnActive && (
              <div style={{ color: '#f39c12', fontSize: 12, marginTop: 4 }}>
                John by {gs.players.find(p => p.id === gs.john.biddingJohnPlayerId)?.name} — win=+2pts / lose=opponent+4pts
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
            {gs.players.map(p => {
              const isActive = gs.bidding.currentBidderPlayerId === p.id;
              const passed = gs.bidding.passedPlayers?.includes(p.id);
              const bid = gs.bidding.playerBids?.[p.id];
              const isJohnP = gs.john?.biddingJohnPlayerId === p.id;
              const teamColor = p.team === 'A' ? '#3498db' : '#e74c3c';
              return (
                <div key={p.id} style={{
                  background: isActive ? 'rgba(212,175,55,0.15)' : passed ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isActive ? GOLD : passed ? '#333' : teamColor}`,
                  borderRadius: 10, padding: '8px 14px', textAlign: 'center', minWidth: 90,
                  opacity: passed ? 0.5 : 1,
                }}>
                  <div style={{ color: isActive ? GOLD : '#ccc', fontSize: 13, fontWeight: isActive ? 'bold' : 'normal' }}>
                    {p.name}{p.id === playerId ? ' (You)' : ''}
                  </div>
                  <div style={{ color: teamColor, fontSize: 11, marginBottom: 4 }}>Team {p.team}</div>
                  <div style={{ fontSize: 12, color: passed ? '#c0392b' : bid !== undefined ? '#27ae60' : '#4a6a8a' }}>
                    {passed ? '✗ Passed' : bid !== undefined ? `${isJohnP ? '🃏 ' : ''}Bid: ${bid}` : isActive ? '⏳' : 'Waiting'}
                  </div>
                </div>
              );
            })}
          </div>

          {isMyBidTurn && !iHavePassed && (
            <div>
              {johnActive && (
                <div style={{
                  background: 'rgba(243,156,18,0.15)', border: '1px solid #f39c12',
                  borderRadius: 10, padding: '10px 16px', marginBottom: 14, textAlign: 'center',
                  color: '#f39c12', fontWeight: 'bold', fontSize: 13,
                }}>
                  🃏 JOHN active — bid 15 or lower to cancel, or Pass
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10 }}>
                {getQuickBids(gs.bidding.currentBid, gs.bidding.isFirstBid).map(val => (
                  <button key={val} onClick={() => onPlaceBid(val)} style={quickBidBtn}>{val}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <input
                  type="number"
                  placeholder={gs.bidding.isFirstBid ? `≤ ${gs.bidding.currentBid}` : `< ${gs.bidding.currentBid}`}
                  value={customBid}
                  onChange={e => setCustomBid(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const v = parseInt(customBid);
                      if (!isNaN(v)) { onPlaceBid(v); setCustomBid(''); }
                    }
                  }}
                  style={{
                    padding: '10px 14px', borderRadius: 8, width: 110,
                    background: 'rgba(255,255,255,0.06)', border: `1px solid ${GOLD}`,
                    color: '#fff', fontSize: 16, textAlign: 'center', fontFamily: 'Georgia, serif',
                  }}
                />
                <ActionBtn color={GOLD} textColor="#0a1628"
                  onClick={() => { const v = parseInt(customBid); if (!isNaN(v)) { onPlaceBid(v); setCustomBid(''); } }}>
                  Bid
                </ActionBtn>
                {!johnAlreadyCalled && (
                  <ActionBtn color="#f39c12" textColor="#0a1628" onClick={onPlaceBidJohn}>
                    🃏 John
                  </ActionBtn>
                )}
                <ActionBtn color="#c0392b" onClick={onPassBid}>Pass</ActionBtn>
              </div>
              <div style={{ color: '#4a6a8a', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
                {johnActive ? 'Bid 15 or lower to cancel John, or Pass'
                  : gs.bidding.isFirstBid ? 'Bid 21 or lower, click 🃏 John (16pts), or Pass'
                    : `Bid lower than ${gs.bidding.currentBid}, or Pass`}
              </div>
            </div>
          )}

          {iHavePassed && (
            <div style={{ textAlign: 'center', color: '#c0392b', fontWeight: 'bold', fontSize: 15, padding: 16 }}>
              ✗ You have passed this round
            </div>
          )}

          {!isMyBidTurn && !iHavePassed && (
            <WaitMsg>Waiting for {gs.players.find(p => p.id === gs.bidding.currentBidderPlayerId)?.name}...</WaitMsg>
          )}
        </PhaseBox>
      )}

      {gs.phase === 'JOHN_OPTION' && (
        <JohnOptionPhase gs={gs} playerId={playerId} onRespondMidgameJohn={onRespondMidgameJohn} />
      )}

      {gs.phase === 'TRUMP_SELECTION' && (
        <PhaseBox title="Select Trump Card">
          {gs.bidding.forcedTrump && (
            <div style={{
              background: 'rgba(192,57,43,0.2)', border: '1px solid #c0392b',
              borderRadius: 10, padding: '10px 20px', marginBottom: 20,
              color: '#e74c3c', textAlign: 'center', fontSize: 14,
            }}>
              ⚡ Forced! Team {gs.trump.trumpTeam} must pick trump!
            </div>
          )}
          {isMyTrumpTurn ? (
            <div>
              <div style={{ color: '#ccc', textAlign: 'center', marginBottom: 8, fontSize: 14 }}>
                {gs.bidding.forcedTrump
                  ? 'Pick one card — first to pick wins!'
                  : `You won at ${gs.bidding.targetBid}. Tap a card — its suit becomes secret trump.`}
              </div>
              <div style={{ color: '#6b8aaa', fontSize: 12, textAlign: 'center', marginBottom: 16 }}>
                Reserved — hidden until revealed in play
              </div>
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
            <>
              <div style={{ color: '#ccc', textAlign: 'center', marginBottom: 20, fontSize: 14 }}>
                {gs.bidding.forcedTrump
                  ? `Both Team ${gs.trump.trumpTeam} players can pick — first one wins!`
                  : `Waiting for ${gs.players.find(p => p.id === gs.trump.trumpPickerPlayerId)?.name} to pick trump...`}
              </div>
              <WaitMsg>🔒 Trump card is being selected secretly...</WaitMsg>
            </>
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
  const pickerName = gs.players?.find(p => p.id === deciders[0])?.name || '';

  return (
    <PhaseBox title="🃏 JOHN Option!">
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ color: '#f39c12', fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>
          Team {johnTeam} won first 4 tricks!
        </div>
        <div style={{ color: '#ccc', fontSize: 14, marginBottom: 8 }}>
          {amDecider
            ? <>Do you want to call <b style={{ color: '#f39c12' }}>JOHN</b>?</>
            : <><b style={{ color: '#f39c12' }}>{pickerName}</b> (trump picker) is deciding on John...</>
          }
        </div>
        <div style={{ color: '#7f8c8d', fontSize: 12 }}>
          Win all 3 remaining → <b style={{ color: '#27ae60' }}>+2 pts</b> &nbsp;|&nbsp;
          Lose any → opponent <b style={{ color: '#e74c3c' }}>+4 pts</b>
        </div>
      </div>

      {amDecider ? (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <ActionBtn color="#f39c12" textColor="#0a1628" onClick={() => onRespondMidgameJohn(true)}>
            🃏 Accept John
          </ActionBtn>
          <ActionBtn color="#4a6a8a" onClick={() => onRespondMidgameJohn(false)}>Skip</ActionBtn>
        </div>
      ) : (
        <WaitMsg>⏳ Waiting for {pickerName} to decide...</WaitMsg>
      )}
    </PhaseBox>
  );
}

function CardSelectable({ card, onClick }) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const [hovered, setHovered] = React.useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        width: 64, height: 88, background: '#fff', borderRadius: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', cursor: 'pointer',
        boxShadow: hovered ? '0 0 0 3px #d4af37, 0 8px 24px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.4)',
        transform: hovered ? 'translateY(-6px)' : 'none',
        transition: 'all 0.15s',
        border: hovered ? '2px solid #d4af37' : '2px solid transparent',
      }}>
      <div style={{ fontSize: 20, fontWeight: 'bold', color: isRed ? '#e74c3c' : '#1a1a2e', lineHeight: 1 }}>{card.rank}</div>
      <div style={{ fontSize: 22, color: isRed ? '#e74c3c' : '#1a1a2e' }}>{card.symbol}</div>
    </div>
  );
}

function PhaseBox({ title, children }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,175,55,0.2)',
      borderRadius: 20, padding: '28px 32px', width: '100%', maxWidth: 520,
    }}>
      <div style={{
        color: '#d4af37', fontSize: 16, fontWeight: 'bold', letterSpacing: 2,
        textAlign: 'center', marginBottom: 20, textTransform: 'uppercase'
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function WaitMsg({ children }) {
  return <div style={{ color: '#4a6a8a', textAlign: 'center', fontSize: 14, padding: '12px 0' }}>{children}</div>;
}

function ActionBtn({ children, onClick, color, textColor = '#fff' }) {
  return (
    <button onClick={onClick} style={{
      padding: '12px 22px', borderRadius: 10, background: color,
      color: textColor, border: 'none', fontWeight: 'bold',
      fontSize: 15, cursor: 'pointer', fontFamily: 'Georgia, serif',
    }}>
      {children}
    </button>
  );
}

function CardMini({ card }) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  return (
    <div style={{
      width: 52, height: 72, background: '#fff', borderRadius: 8,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    }}>
      <div style={{ fontSize: 18, fontWeight: 'bold', color: isRed ? '#e74c3c' : '#1a1a2e', lineHeight: 1 }}>{card.rank}</div>
      <div style={{ fontSize: 18, color: isRed ? '#e74c3c' : '#1a1a2e' }}>{card.symbol}</div>
    </div>
  );
}

const quickBidBtn = {
  padding: '10px 16px', borderRadius: 8,
  background: 'rgba(212,175,55,0.15)', border: '1px solid #d4af37',
  color: '#d4af37', fontWeight: 'bold', fontSize: 16,
  cursor: 'pointer', fontFamily: 'Georgia, serif',
};

function getQuickBids(currentBid, isFirstBid) {
  const start = isFirstBid ? currentBid : currentBid - 1;
  const bids = [];
  for (let i = start; i >= Math.max(0, start - 5); i--) bids.push(i);
  return bids;
}
