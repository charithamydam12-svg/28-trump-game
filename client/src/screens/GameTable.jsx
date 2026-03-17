import React from 'react';
import ReactDOM from 'react-dom';

const GOLD = '#d4af37';
const FELT = '#1a4a2e';

const SUIT_COLORS = {
  hearts: '#e74c3c', diamonds: '#e74c3c',
  spades: '#fff', clubs: '#fff',
};

export default function GameTable({ gameState, myHand, playerId, onPlayCard, onRequestMyTrump, isHost, onEndGame, onExitGame, trumpRevealFlash, connected }) {
  const gs = gameState;
  const [myRevealedTrump, setMyRevealedTrump] = React.useState(null);

  // Reset when new round starts
  React.useEffect(() => {
    setMyRevealedTrump(null);
  }, [gs?.gameNumber]);

  // Don't render if game state not ready
  if (!gs || !gs.players || !gs.trump) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a1628', display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: '#d4af37', fontSize: 20
      }}>
        Loading game...
      </div>
    );
  }

  const handleShowTrump = () => {
    console.log('SHOW TRUMP CLICKED');
    if (!onRequestMyTrump) { console.log('NO HANDLER'); return; }
    // Use raw socket emit directly - bypass the async wrapper
    onRequestMyTrump().then(res => {
      console.log('TRUMP RESPONSE:', res);
      if (res && res.trumpSuit) setMyRevealedTrump({ suit: res.trumpSuit, card: res.trumpCard || null });
    }).catch(e => console.log('TRUMP ERROR:', e));
  };

  const myPlayer = gs.players?.find((p) => p.id === playerId);
  const myTeam = myPlayer?.team;
  const isMyTurn = gs.currentTurnPlayerId === playerId;
  const leadSuit = gs.leadSuit;
  const hasLeadSuit = leadSuit ? myHand.some(c => c.suit === leadSuit) : true;
  const trumpStillHidden = gs.trump.suitHidden && !gs.trump.revealed;
  // Show the button only when: my turn, in a trick (not leading), no lead suit cards, trump not yet revealed to me
  const canShowTrump = isMyTurn && gs.currentTrick?.length > 0 && !hasLeadSuit && trumpStillHidden && !myRevealedTrump?.suit && !gs.trump.iKnowTrump;

  // Sort players around the table: me bottom, left, top, right
  const orderedPlayers = getTableOrder(gs.players, playerId);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: `radial-gradient(ellipse at center, #0d2137 0%, #0a1628 70%)`,
      userSelect: 'none',
    }}>

      {/* ── TOP BAR ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 24px',
        background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <ScorePill team="A" score={gs.matchScore.A} color="#3498db" />
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: GOLD, fontWeight: 'bold', fontSize: 18 }}>
            Game {gs.gameNumber}
          </div>
          <div style={{ color: '#6b8aaa', fontSize: 12 }}>
            {gs.trump.revealed && gs.trump.suit
              ? <span style={{ color: ['hearts', 'diamonds'].includes(gs.trump.suit) ? '#e74c3c' : '#fff' }}>
                Trump: {SUIT_SYMBOLS[gs.trump.suit]}
              </span>
              : gs.trump.iKnowTrump && gs.trump.suit
                ? <span style={{ color: '#f39c12' }}>🔒 Your Trump: {SUIT_SYMBOLS[gs.trump.suit]} (secret)</span>
                : myRevealedTrump
                  ? <span style={{ color: '#f39c12' }}>🔒 Trump: {SUIT_SYMBOLS[myRevealedTrump.suit]} (you peeked)</span>
                  : gs.trump.suitHidden
                    ? <span style={{ color: '#8e44ad' }}>🔒 Trump: Hidden</span>
                    : 'No trump yet'}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div title={connected ? 'Connected' : 'Connecting...'} style={{
              width: 9, height: 9, borderRadius: '50%',
              background: connected ? '#27ae60' : '#e74c3c',
              boxShadow: connected ? '0 0 6px #27ae60' : '0 0 6px #e74c3c',
            }} />
            <ScorePill team="B" score={gs.matchScore.B} color="#e74c3c" />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {isHost && (
              <button onClick={onEndGame} style={{
                padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(192,57,43,0.6)',
                background: 'rgba(192,57,43,0.15)', color: '#e74c3c', cursor: 'pointer',
                fontSize: 10, fontWeight: 'bold',
              }}>
                ✕ End
              </button>
            )}
            <button onClick={onExitGame} style={{
              padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(74,106,138,0.6)',
              background: 'rgba(74,106,138,0.15)', color: '#7f8c8d', cursor: 'pointer',
              fontSize: 10, fontWeight: 'bold',
            }}>
              🚪 Exit
            </button>
          </div>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>

        {/* Top player */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}>
          <PlayerSeat player={orderedPlayers[2]} isCurrentTurn={gs.currentTurnPlayerId === orderedPlayers[2]?.id} isTrumpPicker={gs.trump?.trumpPickerPlayerId === orderedPlayers[2]?.id} />
        </div>

        {/* Middle row: left player, felt table, right player */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
          <PlayerSeat player={orderedPlayers[1]} isCurrentTurn={gs.currentTurnPlayerId === orderedPlayers[1]?.id} vertical isTrumpPicker={gs.trump?.trumpPickerPlayerId === orderedPlayers[1]?.id} />
          <FeltTable gs={gs} orderedPlayers={orderedPlayers} />
          <PlayerSeat player={orderedPlayers[3]} isCurrentTurn={gs.currentTurnPlayerId === orderedPlayers[3]?.id} vertical isTrumpPicker={gs.trump?.trumpPickerPlayerId === orderedPlayers[3]?.id} />
        </div>

        {/* Bottom: my info */}
        <div style={{ padding: '0 8px 2px', display: 'flex', justifyContent: 'center' }}>
          <PlayerSeat player={orderedPlayers[0]} isCurrentTurn={isMyTurn} isMe isTrumpPicker={gs.trump?.trumpPickerPlayerId === orderedPlayers[0]?.id} />
        </div>
      </div>

      {/* ── MY HAND ── */}
      <div style={{
        background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '16px 20px 24px',
        position: 'relative', zIndex: 10,
      }}>
        {gs.phase === 'PLAYING' && isMyTurn && (
          <>
            <div style={{
              textAlign: 'center', color: GOLD, fontWeight: 'bold',
              fontSize: 14, marginBottom: 10, letterSpacing: 1, animation: 'pulse 1.5s infinite',
            }}>
              ⭐ YOUR TURN — Play a card
            </div>
            {gs.trump?.mustPlayReservedTrump && (
              <div style={{ textAlign: 'center', color: '#e74c3c', fontSize: 12, marginBottom: 6, fontWeight: 'bold' }}>
                ⚠️ No lead suit — you must play your reserved trump card!
              </div>
            )}
            {gs.mustPlayTrump === playerId && myHand.some(c => c.suit === gs.trump?.suit) && !gs.trump?.mustPlayReservedTrump && (
              <div style={{ textAlign: 'center', color: '#e74c3c', fontSize: 12, marginBottom: 6, fontWeight: 'bold' }}>
                ⚠️ You showed trump — must play a trump card {SUIT_SYMBOLS[gs.trump?.suit]}
              </div>
            )}
          </>
        )}
        {gs.phase === 'PLAYING' && !isMyTurn && (
          <div style={{ textAlign: 'center', color: '#4a6a8a', fontSize: 13, marginBottom: 10 }}>
            Waiting for {gs.players.find((p) => p.id === gs.currentTurnPlayerId)?.name}...
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {myHand.map((card) => (
            <PlayingCard
              key={card.id}
              card={card}
              playable={isMyTurn && !gs.trump?.mustPlayReservedTrump}
              leadSuit={gs.leadSuit}
              hand={myHand}
              mustPlayTrump={gs.mustPlayTrump === playerId ? gs.trump?.suit : null}
              onClick={() => isMyTurn && !gs.trump?.mustPlayReservedTrump && onPlayCard(card.id)}
            />
          ))}

          {/* Reserved trump card — only picker sees this */}
          {gs.trump?.myReservedTrump && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 10, color: gs.trump.mustPlayReservedTrump ? '#e74c3c' : '#d4af37', letterSpacing: 1, textTransform: 'uppercase', fontWeight: gs.trump.mustPlayReservedTrump ? 'bold' : 'normal' }}>
                {gs.trump.mustPlayReservedTrump ? '⚠️ PLAY THIS' : '🔒 Trump'}
              </div>
              <PlayingCard
                card={gs.trump.myReservedTrump}
                playable={gs.trump.canPlayReservedTrump}
                leadSuit={gs.leadSuit}
                hand={myHand}
                onClick={() => gs.trump.canPlayReservedTrump && onPlayCard(gs.trump.myReservedTrump.id)}
                dimmed={!gs.trump.canPlayReservedTrump}
              />
              {gs.trump.mustPlayReservedTrump && (
                <div style={{ fontSize: 10, color: '#e74c3c', textAlign: 'center', maxWidth: 70, fontWeight: 'bold' }}>
                  Must play!
                </div>
              )}
              {!gs.trump.canPlayReservedTrump && !gs.trump.mustPlayReservedTrump && (
                <div style={{ fontSize: 10, color: '#4a6a8a', textAlign: 'center', maxWidth: 64 }}>
                  reserved
                </div>
              )}
            </div>
          )}

          {/* Show trump section for other players — they see a face-down card */}
          {!gs.trump?.myReservedTrump && gs.hasReservedTrump && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 10, color: '#4a6a8a', letterSpacing: 1 }}>
                🔒 hidden
              </div>
              <div style={{
                width: 52, height: 72, borderRadius: 8,
                background: 'linear-gradient(135deg, #1a3a5c, #0d2137)',
                border: '2px solid rgba(212,175,55,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 20, opacity: 0.4 }}>🂠</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.5} }
        @keyframes cardPlay {
          from { transform: scale(1.1) translateY(-10px); }
          to   { transform: scale(1) translateY(0); }
        }
      `}</style>

      {canShowTrump && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', bottom: 170, left: '50%', transform: 'translateX(-50%)',
          zIndex: 99999, textAlign: 'center', pointerEvents: 'auto',
        }}>
          <button
            onClick={handleShowTrump}
            style={{
              padding: '12px 32px',
              background: '#8e44ad',
              border: '3px solid #c39bd3',
              borderRadius: 28, color: '#fff',
              fontSize: 16, cursor: 'pointer',
              fontFamily: 'Georgia, serif', fontWeight: 'bold',
              boxShadow: '0 4px 24px rgba(142,68,173,0.8)',
              pointerEvents: 'auto',
            }}
          >
            🔍 Show Trump
          </button>
          <div style={{ color: '#c39bd3', fontSize: 12, marginTop: 5, textShadow: '0 1px 4px #000' }}>
            No {leadSuit} cards — tap to peek
          </div>
        </div>,
        document.body
      )}

      {/* Trump reveal flash — shown once for 3 seconds */}
      {trumpRevealFlash && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 11000, pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(10,22,40,0.92)', border: `2px solid ${['hearts', 'diamonds'].includes(trumpRevealFlash.suit) ? '#e74c3c' : '#d4af37'}`,
            borderRadius: 20, padding: '24px 40px', textAlign: 'center',
            boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
            animation: 'fadeInOut 5s ease forwards',
          }}>
            <div style={{ color: '#7f8c8d', fontSize: 12, letterSpacing: 2, marginBottom: 8 }}>TRUMP CARD</div>
            <div style={{
              fontSize: 56, fontWeight: 'bold', lineHeight: 1,
              color: ['hearts', 'diamonds'].includes(trumpRevealFlash.suit) ? '#e74c3c' : '#fff',
            }}>
              {trumpRevealFlash.card ? `${trumpRevealFlash.card.rank}${trumpRevealFlash.symbol}` : trumpRevealFlash.symbol}
            </div>
            <div style={{ color: '#7f8c8d', fontSize: 12, marginTop: 10 }}>
              {trumpRevealFlash.playedBy} revealed trump
            </div>
          </div>
          <style>{`@keyframes fadeInOut { 0%{opacity:0;transform:scale(0.8)} 10%{opacity:1;transform:scale(1)} 80%{opacity:1} 100%{opacity:0;transform:scale(0.9)} }`}</style>
        </div>,
        document.body
      )}

    </div>
  );
}

// ─── FELT TABLE CENTER ───────────────────────────────────────
function FeltTable({ gs, orderedPlayers }) {
  // Map each player's position to a table slot:
  // orderedPlayers[0]=me(bottom), [1]=left, [2]=top, [3]=right
  const slotForPlayer = {};
  if (orderedPlayers[0]) slotForPlayer[orderedPlayers[0].id] = 'bottom';
  if (orderedPlayers[1]) slotForPlayer[orderedPlayers[1].id] = 'left';
  if (orderedPlayers[2]) slotForPlayer[orderedPlayers[2].id] = 'top';
  if (orderedPlayers[3]) slotForPlayer[orderedPlayers[3].id] = 'right';

  const cardsBySlot = {};
  (gs.currentTrick || []).forEach(({ playerId, card }) => {
    const slot = slotForPlayer[playerId] || 'center';
    cardsBySlot[slot] = card;
  });

  const cardPos = {
    top: { top: 8, left: '50%', transform: 'translateX(-50%)' },
    bottom: { bottom: 8, left: '50%', transform: 'translateX(-50%)' },
    left: { left: 8, top: '50%', transform: 'translateY(-50%)' },
    right: { right: 8, top: '50%', transform: 'translateY(-50%)' },
  };

  return (
    <div style={{
      flex: 1, maxWidth: 340, height: 260,
      borderRadius: 32,
      background: `radial-gradient(ellipse, #1e5c3a, ${FELT})`,
      border: '6px solid #2d6b45',
      boxShadow: 'inset 0 0 50px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.5)',
      position: 'relative', margin: '0 4px',
    }}>
      {/* SA left side, SB right side */}
      <TrickScore team="A" count={gs.trickCounts?.A || 0} color="#3498db" side="left" />
      <TrickScore team="B" count={gs.trickCounts?.B || 0} color="#e74c3c" side="right" />

      {/* Cards at 4 positions */}
      {['top', 'bottom', 'left', 'right'].map(slot => (
        cardsBySlot[slot] ? (
          <div key={slot} style={{ position: 'absolute', ...cardPos[slot], zIndex: 3, animation: 'cardPlay 0.3s ease' }}>
            <TableCard card={cardsBySlot[slot]} />
          </div>
        ) : null
      ))}

      {/* Empty state */}
      {(gs.currentTrick || []).length === 0 && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'rgba(255,255,255,0.2)', fontSize: 13, textAlign: 'center', zIndex: 1 }}>
          {gs.trickCount >= 7 ? 'Round Complete!' : `Serve ${(gs.trickCount || 0) + 1} of 7`}
        </div>
      )}

      {/* Lead suit */}
      {gs.leadSuit && (
        <div style={{ position: 'absolute', bottom: 8, right: 12, color: SUIT_COLORS[gs.leadSuit], fontSize: 18, zIndex: 2 }}>
          {SUIT_SYMBOLS[gs.leadSuit]}
        </div>
      )}

      {/* Trick result winner banner */}
      {gs.phase === 'TRICK_RESULT' && gs.lastTrickWinner && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          background: 'rgba(10,22,40,0.85)', border: '1px solid rgba(212,175,55,0.6)',
          borderRadius: 10, padding: '6px 14px', color: GOLD, fontSize: 13, fontWeight: 'bold',
          whiteSpace: 'nowrap', zIndex: 4, textAlign: 'center',
        }}>
          🏆 {(gs.players || []).find(p => p.id === gs.lastTrickWinner)?.name}
        </div>
      )}
    </div>
  );
}

// ─── PLAYER SEAT ─────────────────────────────────────────────
function PlayerSeat({ player, isCurrentTurn, isMe, vertical, isTrumpPicker }) {
  if (!player) return <div style={{ width: vertical ? 60 : 120 }} />;

  const teamColor = player.team === 'A' ? '#3498db' : '#e74c3c';
  const isOffline = player.connected === false;

  return (
    <div style={{
      display: 'flex', flexDirection: vertical ? 'column' : 'row',
      alignItems: 'center', gap: 8,
      opacity: isOffline ? 0.6 : 1,
    }}>
      <div style={{ position: 'relative' }}>
        {isTrumpPicker && (
          <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 16, zIndex: 5, lineHeight: 1 }}>👑</div>
        )}
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: teamColor, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontWeight: 'bold', fontSize: 18,
          border: isCurrentTurn ? `3px solid ${GOLD}` : isTrumpPicker ? '3px solid #f39c12' : '3px solid transparent',
          boxShadow: isCurrentTurn ? `0 0 16px ${GOLD}` : isTrumpPicker ? '0 0 10px #f39c12' : 'none',
          transition: 'all 0.3s', color: '#fff',
        }}>
          {player.name[0].toUpperCase()}
        </div>
        {/* Online/offline dot */}
        <div style={{
          position: 'absolute', bottom: 1, right: 1,
          width: 11, height: 11, borderRadius: '50%',
          background: isOffline ? '#e74c3c' : '#27ae60',
          border: '2px solid #0a1628',
        }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: isMe ? GOLD : '#ccc', fontSize: 13, fontWeight: isMe ? 'bold' : 'normal' }}>
          {player.name}{isMe ? ' (You)' : ''}{isOffline ? ' 📵' : ''}
        </div>
        <div style={{ color: teamColor, fontSize: 11 }}>Team {player.team}</div>
        <div style={{ color: '#4a6a8a', fontSize: 11 }}>{player.cardCount} cards</div>
      </div>
    </div>
  );
}

// ─── PLAYING CARD ─────────────────────────────────────────────
function PlayingCard({ card, playable, leadSuit, hand, onClick, mustPlayTrump }) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  // Check if this card can be legally played
  const hasLeadSuit = leadSuit ? hand.some((c) => c.suit === leadSuit) : true;
  const isLegal = !leadSuit || !hasLeadSuit || card.suit === leadSuit;

  // mustPlayTrump: if player showed trump, must play trump suit (unless no trump cards)
  const hasTrumpCards = mustPlayTrump ? hand.some(c => c.suit === mustPlayTrump) : false;
  const trumpBlocked = mustPlayTrump && hasTrumpCards && card.suit !== mustPlayTrump;

  const disabled = playable && (!isLegal || trumpBlocked);

  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        width: 60, height: 84, background: '#fff', borderRadius: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 2,
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        border: '1px solid #ddd',
        cursor: playable && !disabled ? 'pointer' : 'default',
        opacity: disabled ? 0.35 : 1,
        transform: playable && !disabled ? 'none' : 'none',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (playable && !disabled) e.currentTarget.style.transform = 'translateY(-8px) scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 'bold', color: isRed ? '#e74c3c' : '#1a1a2e', lineHeight: 1 }}>
        {card.rank}
      </div>
      <div style={{ fontSize: 22, color: isRed ? '#e74c3c' : '#1a1a2e', lineHeight: 1 }}>{card.symbol}</div>
      {card.points > 0 && (
        <div style={{
          fontSize: 9, color: '#888', marginTop: 2,
          background: '#f5f5f5', borderRadius: 4, padding: '1px 5px',
        }}>
          {card.points}pt
        </div>
      )}
    </div>
  );
}

function TableCard({ card }) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  return (
    <div style={{
      width: 44, height: 62, background: '#fff', borderRadius: 7,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', boxShadow: '0 3px 10px rgba(0,0,0,0.4)',
      border: '1px solid #ddd',
    }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', color: isRed ? '#e74c3c' : '#1a1a2e', lineHeight: 1 }}>
        {card.rank}
      </div>
      <div style={{ fontSize: 16, color: isRed ? '#e74c3c' : '#1a1a2e', lineHeight: 1 }}>{card.symbol}</div>
    </div>
  );
}

function ScorePill({ team, score, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: `rgba(${color === '#3498db' ? '52,152,219' : '231,76,60'},0.1)`,
      border: `1px solid ${color}`, borderRadius: 20, padding: '6px 16px',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 'bold', fontSize: 14, color: '#fff',
      }}>
        {team}
      </div>
      <div>
        <div style={{ color, fontWeight: 'bold', fontSize: 20, lineHeight: 1 }}>{score}</div>
        <div style={{ color: '#4a6a8a', fontSize: 10 }}>/ 12</div>
      </div>
    </div>
  );
}

function TrickScore({ team, count, color, side }) {
  const pos = side === 'left'
    ? { position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 2 }
    : { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 2 };
  return (
    <div style={{ ...pos, textAlign: 'center' }}>
      <div style={{ color, fontSize: 22, fontWeight: 'bold', lineHeight: 1 }}>{count}</div>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 }}>S{team}</div>
    </div>
  );
}

// Order players: [me, left, opposite, right]
function getTableOrder(players, myId) {
  const me = players.find(p => p.id === myId);
  if (!me) return players;

  // Play order is clockwise by position: 0→1→2→3→0
  // From my seat (bottom):
  //   [0] = me (bottom)
  //   [1] = left  = next player clockwise after me (position+1 % 4)
  //   [2] = top   = teammate (position+2 % 4)
  //   [3] = right = player before me clockwise (position+3 % 4)
  const myPos = me.position;
  const byPos = {};
  players.forEach(p => { byPos[p.position] = p; });

  return [
    byPos[myPos % 4],           // bottom = me
    byPos[(myPos + 1) % 4],     // left   = next clockwise
    byPos[(myPos + 2) % 4],     // top    = teammate
    byPos[(myPos + 3) % 4],     // right  = prev clockwise
  ];
}

const SUIT_SYMBOLS = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
};
