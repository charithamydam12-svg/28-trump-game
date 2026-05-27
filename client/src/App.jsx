import React, { useState, useEffect, useRef, Component } from 'react';
import { useSocket } from './hooks/useSocket';
import { auth, api } from './api';
import HomeScreen from './screens/HomeScreen';
import LobbyScreen from './screens/LobbyScreen';
import BiddingScreen from './screens/BiddingScreen';
import GameTable from './screens/GameTable';
import RoundResultScreen from './screens/RoundResultScreen';
import MatchOverScreen from './screens/MatchOverScreen';
import AuthScreen from './screens/AuthScreen';
import ProfileScreen from './screens/ProfileScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', background: '#0a1628', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
          color: '#fff', padding: 32, gap: 16
        }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <div style={{ fontSize: 22, color: '#e74c3c', fontWeight: 'bold' }}>Something went wrong</div>
          <div style={{ color: '#8fa8c8', fontSize: 14, maxWidth: 500, textAlign: 'center' }}>
            {this.state.error?.message || 'Unknown error'}
          </div>
          <button onClick={() => window.location.reload()}
            style={{
              marginTop: 16, padding: '12px 28px', background: '#d4af37', border: 'none',
              borderRadius: 10, fontWeight: 'bold', cursor: 'pointer', fontSize: 15
            }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const BIDDING_PHASES = ['BIDDING', 'ASK_LOSING_TEAM', 'TRUMP_SELECTION', 'JOHN_OPTION'];

function GameApp() {
  const socket = useSocket();
  const hasSession = (() => { try { return !!localStorage.getItem('28trump_session'); } catch (e) { return false; } })();
  const [user, setUser] = useState(auth.getUser());
  const initialScreen = !auth.isLoggedIn() ? 'AUTH' : (hasSession ? 'RECONNECTING' : 'HOME');
  const [screen, setScreen] = useState(initialScreen);

  // Refresh user data on load to get latest stats
  useEffect(() => {
    if (!auth.isLoggedIn()) return;
    api.me().then(({ user }) => {
      auth.updateUser(user);
      setUser(user);
    }).catch(() => {
      // Token invalid → log out
      auth.logout();
      setUser(null);
      setScreen('AUTH');
    });
  }, []);

  const handleLogout = () => {
    auth.logout();
    setUser(null);
    setScreen('AUTH');
  };

  // If reconnecting but no state arrives in 6s → go home (session kept, can retry)
  useEffect(() => {
    if (screen !== 'RECONNECTING') return;
    const t = setTimeout(() => setScreen('HOME'), 6000);
    return () => clearTimeout(t);
  }, [screen]);

  // Store round result in a ref so it NEVER gets cleared by re-renders
  const roundResultRef = useRef(null);
  const [showResult, setShowResult] = useState(false);

  const gs = socket.gameState;
  const { disconnectedPlayer, setDisconnectedPlayer, exitRoom } = socket;
  const johnFlash = socket.johnDecisionFlash;

  useEffect(() => {
    if (socket.lobbyState) {
      // Always prefer lobby screen when lobby state arrives (covers rejoin into lobby)
      if (screen === 'HOME' || screen === 'RECONNECTING' || (screen === 'GAME' && !gs)) {
        setScreen('LOBBY');
      }
    }
  }, [socket.lobbyState]);

  useEffect(() => {
    if (gs && gs.phase && gs.phase !== 'LOBBY') setScreen('GAME');
  }, [gs]);

  // When server clears game state (host ended game), go home
  useEffect(() => {
    if (!gs && screen === 'GAME') setScreen('HOME');
  }, [gs, screen]);

  // Show round result — triggers on phase change AND on first gs load (rejoin recovery)
  useEffect(() => {
    if (!gs) return;
    if (gs.phase === 'ROUND_RESULT' || gs.phase === 'MATCH_OVER') {
      if (gs.roundResult) {
        roundResultRef.current = gs.roundResult;
        setShowResult(true);
      }
    }
  }, [gs?.phase, !!gs]); // !!gs catches the null→populated transition on rejoin

  // Clear result for ALL players when gameNumber increments (new round started)
  useEffect(() => {
    if (!gs?.gameNumber) return;
    roundResultRef.current = null;
    setShowResult(false);
  }, [gs?.gameNumber]);

  const handleCreateRoom = async (name) => {
    const res = await socket.createRoom(name, user?.id);
    if (res?.success) setScreen('LOBBY');
  };
  const handleJoinRoom = async (roomId, name) => {
    const res = await socket.joinRoom(roomId, name, user?.id);
    if (res?.success) setScreen('LOBBY');
  };
  const handleStartGame = async () => {
    const res = await socket.startGame();
    if (res?.success) setScreen('GAME');
  };
  const handleNextRound = async () => {
    roundResultRef.current = null;
    setShowResult(false);
    await socket.nextRound();
  };


  // If stuck on GAME screen with no game state for 4s, clear and go home
  useEffect(() => {
    if (screen !== 'GAME' || gs) return;
    const t = setTimeout(() => {
      try { localStorage.removeItem('28trump_session'); } catch (e) { }
      setScreen('HOME');
    }, 4000);
    return () => clearTimeout(t);
  }, [screen, gs]);

  const renderGame = () => {
    if (!gs) return (
      <div style={{
        minHeight: '100vh', background: '#0a1628', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16
      }}>
        <div style={{ color: '#d4af37', fontSize: 20 }}>Loading game...</div>
        <div style={{ color: '#4a6a8a', fontSize: 13 }}>Redirecting in a moment...</div>
        <button onClick={() => { try { localStorage.removeItem('28trump_session'); } catch (e) { } setScreen('HOME'); }}
          style={{
            marginTop: 8, padding: '10px 28px', borderRadius: 10, background: '#d4af37',
            border: 'none', color: '#0a1628', fontSize: 14, cursor: 'pointer', fontWeight: 'bold'
          }}>
          Go Home Now
        </button>
      </div>
    );

    if (gs.phase === 'MATCH_OVER') {
      return (
        <MatchOverScreen
          matchScore={gs.matchScore}
          players={gs.players}
          onNewGame={handleNextRound}
        />
      );
    }

    // Show round result — check phase directly so rejoin always shows it
    const resultData = roundResultRef.current || gs.roundResult;
    if ((gs.phase === 'ROUND_RESULT' || showResult) && resultData) {
      roundResultRef.current = resultData; // keep ref in sync
      const isHost = gs.players?.find(p => p.id === socket.playerId)?.position === 0;
      return (
        <RoundResultScreen
          result={resultData}
          players={gs.players}
          isHost={isHost}
          onNextRound={handleNextRound}
          onExitGame={() => { socket.exitRoom(); setScreen('HOME'); }}
          onEndGame={() => socket.endGame()}
        />
      );
    }

    if (BIDDING_PHASES.includes(gs.phase)) {
      const amHost = gs.players?.find(p => p.id === socket.playerId)?.position === 0;
      return (
        <BiddingScreen
          gameState={gs} myHand={socket.myHand} playerId={socket.playerId}
          onLosingTeamResponse={socket.losingTeamResponse}
          onPlaceBid={socket.placeBid} onPassBid={socket.passBid}
          onPlaceBidJohn={socket.placeBidJohn}
          onRespondMidgameJohn={socket.respondMidgameJohn}
          onSelectTrump={socket.selectTrump} onDeclareBlindTrump={socket.declareBlindTrump}
          isHost={amHost}
          onExitGame={() => { socket.exitRoom(); setScreen('HOME'); }}
          onEndGame={() => socket.endGame()}
        />
      );
    }

    console.log('[App] socket.requestMyTrump =', typeof socket.requestMyTrump, socket.requestMyTrump);
    const amHost = gs.players?.find(p => p.id === socket.playerId)?.position === 0;
    return (
      <GameTable
        gameState={gs}
        myHand={socket.myHand}
        playerId={socket.playerId}
        onPlayCard={socket.playCard}
        onRequestMyTrump={socket.requestMyTrump}
        isHost={amHost}
        onEndGame={() => socket.endGame()}
        onExitGame={() => { socket.exitRoom(); setScreen('HOME'); }}
        trumpRevealFlash={socket.trumpRevealFlash}
        connected={socket.connected}
      />
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a1628', fontFamily: 'Georgia, serif' }}>
      {/* Global connection dot — top left, small, unobtrusive */}
      <div style={{
        position: 'fixed', top: 10, left: 12, zIndex: 9999,
        width: 10, height: 10, borderRadius: '50%',
        background: socket.connected ? '#27ae60' : '#e74c3c',
        boxShadow: socket.connected ? '0 0 8px #27ae60' : '0 0 8px #e74c3c',
      }} title={socket.connected ? 'Connected' : 'Connecting...'} />
      {socket.notification && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: socket.notification.type === 'warning' ? '#c0392b'
            : socket.notification.type === 'success' ? '#27ae60' : '#2980b9',
          color: '#fff', padding: '12px 28px', borderRadius: 30,
          fontWeight: 'bold', zIndex: 9998, boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          {socket.notification.message}
        </div>
      )}

      {/* John decision flash popup */}
      {johnFlash && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 11000, pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(10,22,40,0.93)',
            border: `2px solid ${johnFlash.accepted ? '#f39c12' : '#4a6a8a'}`,
            borderRadius: 20, padding: '24px 40px', textAlign: 'center',
            boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
            animation: 'fadeInOut 4s ease forwards',
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>{johnFlash.accepted ? '🃏' : '🤚'}</div>
            <div style={{ color: johnFlash.accepted ? '#f39c12' : '#7f8c8d', fontWeight: 'bold', fontSize: 20, marginBottom: 6 }}>
              {johnFlash.accepted ? 'JOHN!' : 'Skip'}
            </div>
            <div style={{ color: '#ccc', fontSize: 14 }}>
              {johnFlash.playerName} {johnFlash.accepted ? 'called John — must win all 3 serves!' : 'skipped John'}
            </div>
          </div>
          <style>{`@keyframes fadeInOut { 0%{opacity:0;transform:scale(0.8)} 10%{opacity:1;transform:scale(1)} 80%{opacity:1} 100%{opacity:0;transform:scale(0.9)} }`}</style>
        </div>
      )}

      {/* Persistent disconnect banner — always visible, can't be dismissed */}
      {disconnectedPlayer && screen === 'GAME' && !disconnectedPlayer.permanent && (
        <div style={{
          position: 'fixed', top: 56, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(192,57,43,0.95)', border: '1px solid #e74c3c',
          borderRadius: 12, padding: '12px 20px', zIndex: 9997,
          display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          minWidth: 260, maxWidth: 340,
        }}>
          <div style={{ fontSize: 22 }}>📵</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>
              {disconnectedPlayer.name} is offline
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>
              Waiting for them to reconnect (up to 5 mins)...
            </div>
          </div>
          <button onClick={() => { exitRoom(); setDisconnectedPlayer(null); setScreen('HOME'); }} style={{
            padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.4)',
            background: 'rgba(0,0,0,0.3)', color: '#fff', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap',
          }}>
            Leave Game
          </button>
        </div>
      )}
      {socket.error && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#c0392b', color: '#fff', padding: '12px 28px',
          borderRadius: 30, fontWeight: 'bold', zIndex: 9998,
        }}>
          ⚠️ {socket.error}
        </div>
      )}
      {screen === 'AUTH' && (
        <AuthScreen onLoggedIn={(u) => { setUser(u); setScreen('HOME'); }} />
      )}
      {screen === 'PROFILE' && user && (
        <ProfileScreen user={user} onUpdate={setUser}
          onBack={() => setScreen('HOME')} onLogout={handleLogout} />
      )}
      {screen === 'LEADERBOARD' && (
        <LeaderboardScreen currentUserId={user?.id} onBack={() => setScreen('HOME')} />
      )}
      {screen === 'HOME' && (
        <HomeScreen
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          user={user}
          onProfile={() => setScreen('PROFILE')}
          onLeaderboard={() => setScreen('LEADERBOARD')}
          onLogout={handleLogout}
        />
      )}
      {screen === 'RECONNECTING' && (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'radial-gradient(ellipse at center, #0d2137 0%, #0a1628 70%)',
          color: '#d4af37', fontSize: 20, gap: 16,
        }}>
          <div style={{ fontSize: 40 }}>🃏</div>
          <div style={{ letterSpacing: 2 }}>Reconnecting...</div>
          <div style={{ color: '#4a6a8a', fontSize: 14 }}>Rejoining your game</div>
          <button onClick={() => { try { localStorage.removeItem('28trump_session'); } catch (e) { } setScreen('HOME'); }}
            style={{
              marginTop: 24, padding: '10px 28px', borderRadius: 10, background: 'transparent',
              border: '1px solid #4a6a8a', color: '#4a6a8a', fontSize: 14, cursor: 'pointer'
            }}>
            Cancel &amp; go home
          </button>
        </div>
      )}
      {screen === 'LOBBY' && socket.lobbyState && (
        <LobbyScreen lobby={socket.lobbyState} playerId={socket.playerId}
          onSwapTeam={socket.swapTeam} onStartGame={handleStartGame}
          onExitRoom={() => { socket.exitRoom(); setScreen('HOME'); }}
          onEndGame={() => { socket.endGame(); setScreen('HOME'); }}
        />
      )}
      {screen === 'LOBBY' && !socket.lobbyState && (
        <div style={{
          minHeight: '100vh', background: '#0a1628', display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: '#d4af37', fontSize: 20
        }}>
          Joining room...
        </div>
      )}
      {screen === 'GAME' && renderGame()}
      <style>{`
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}

export default function App() {
  return <ErrorBoundary><GameApp /></ErrorBoundary>;
}
