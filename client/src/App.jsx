import React, { useState, useEffect, useRef, Component } from 'react';
import { useSocket } from './hooks/useSocket';
import HomeScreen from './screens/HomeScreen';
import LobbyScreen from './screens/LobbyScreen';
import BiddingScreen from './screens/BiddingScreen';
import GameTable from './screens/GameTable';
import RoundResultScreen from './screens/RoundResultScreen';
import MatchOverScreen from './screens/MatchOverScreen';

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

const BIDDING_PHASES = ['BIDDING', 'ASK_LOSING_TEAM', 'TRUMP_SELECTION'];

function GameApp() {
  const socket = useSocket();
  const hasSession = (() => { try { return !!localStorage.getItem('28trump_session'); } catch (e) { return false; } })();
  const [screen, setScreen] = useState(hasSession ? 'RECONNECTING' : 'HOME');
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

  useEffect(() => {
    if (socket.lobbyState) {
      if (screen === 'HOME' || screen === 'RECONNECTING') setScreen('LOBBY');
    }
  }, [socket.lobbyState]);

  useEffect(() => {
    if (gs) setScreen('GAME');
  }, [gs]);

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
    const res = await socket.createRoom(name);
    if (res?.success) setScreen('LOBBY');
  };
  const handleJoinRoom = async (roomId, name) => {
    const res = await socket.joinRoom(roomId, name);
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


  const renderGame = () => {
    if (!gs) return (
      <div style={{
        minHeight: '100vh', background: '#0a1628', display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: '#d4af37', fontSize: 20
      }}>
        Loading game...
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
        />
      );
    }

    if (BIDDING_PHASES.includes(gs.phase)) {
      return (
        <BiddingScreen
          gameState={gs} myHand={socket.myHand} playerId={socket.playerId}
          onLosingTeamResponse={socket.losingTeamResponse}
          onPlaceBid={socket.placeBid} onPassBid={socket.passBid}
          onSelectTrump={socket.selectTrump} onDeclareBlindTrump={socket.declareBlindTrump}
        />
      );
    }

    console.log('[App] socket.requestMyTrump =', typeof socket.requestMyTrump, socket.requestMyTrump);
    return (
      <GameTable
        gameState={gs}
        myHand={socket.myHand}
        playerId={socket.playerId}
        onPlayCard={socket.playCard}
        onRequestMyTrump={socket.requestMyTrump}
      />
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a1628', fontFamily: 'Georgia, serif' }}>
      <div style={{
        position: 'fixed', top: 10, right: 12, zIndex: 9999,
        background: socket.connected ? 'rgba(39,174,96,0.2)' : 'rgba(192,57,43,0.2)',
        border: `1px solid ${socket.connected ? '#27ae60' : '#c0392b'}`,
        borderRadius: 20, padding: '4px 12px', fontSize: 12,
        color: socket.connected ? '#27ae60' : '#e74c3c',
      }}>
        {socket.connected ? '● Connected' : '○ Connecting...'}
      </div>
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
      {socket.error && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#c0392b', color: '#fff', padding: '12px 28px',
          borderRadius: 30, fontWeight: 'bold', zIndex: 9998,
        }}>
          ⚠️ {socket.error}
        </div>
      )}
      {screen === 'HOME' && <HomeScreen onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />}
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
          onSwapTeam={socket.swapTeam} onStartGame={handleStartGame} />
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
