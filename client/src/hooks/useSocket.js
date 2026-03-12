import { useState, useEffect, useCallback, useRef } from 'react';

const SERVER_URL = 'http://localhost:3001';

export function useSocket() {
  const socketRef = useRef(null);

  const [connected, setConnected]   = useState(false);
  const [playerId, setPlayerId]     = useState(null);
  const [roomId, setRoomId]         = useState(null);
  const [lobbyState, setLobbyState] = useState(null);
  const [gameState, setGameState]   = useState(null);
  const [myHand, setMyHand]         = useState([]);
  const [notification, setNotification] = useState(null);
  const [error, setError]           = useState(null);

  function showNotification(message, type = 'info') {
    setNotification({ message, type, id: Date.now() });
    setTimeout(() => setNotification(null), 3500);
  }
  function showError(msg) {
    setError(msg);
    setTimeout(() => setError(null), 3500);
  }

  useEffect(() => {
    let socket;
    import('socket.io-client').then(({ io }) => {
      socket = io(SERVER_URL, { reconnectionAttempts: 5, timeout: 10000 });
      socketRef.current = socket;

      socket.on('connect', () => {
        setConnected(true);
        setPlayerId(socket.id);

        // Auto-rejoin on page reload
        try {
          const raw = localStorage.getItem('28trump_session');
          if (raw) {
            const { persistentId: _pid, roomId: savedRoom, playerName } = JSON.parse(raw);
            console.log('[rejoin] attempting:', { savedRoom, newSocketId: socket.id });
            const persistentId = JSON.parse(raw).persistentId;
            if (persistentId && savedRoom) {
              socket.emit('rejoin_room', { roomId: savedRoom, persistentId, playerName }, (res) => {
                if (res?.success) {
                  setPlayerId(res.playerId);
                  setRoomId(res.roomId);
                  // persistentId never changes — session stays valid forever
                  console.log('✅ Rejoined room', savedRoom, 'socket:', res.playerId);
                } else {
                  console.log('❌ Rejoin failed:', res?.error);
                  if (res?.error === 'Room not found') {
                    localStorage.removeItem('28trump_session');
                  }
                }
              });
            }
          }
        } catch(e) { console.log('[rejoin] error:', e); }
      });

      socket.on('disconnect', () => setConnected(false));
      socket.on('connect_error', () => {});

      socket.on('lobby_state', (s) => setLobbyState(s));

      // game_state has myHand (private) and roundResult embedded
      socket.on('game_state', (s) => {
        if (Array.isArray(s.myHand)) {
          setMyHand(s.myHand);
        }
        // Keep roundResult in publicState so App.jsx can react to it
        const { myHand: _hand, ...publicState } = s;
        setGameState(publicState);
      });

      socket.on('player_disconnected', () =>
        showNotification('A player disconnected', 'warning'));

      socket.on('trump_selected', ({ pickerName, trumpTeam }) => {
        showNotification(`${pickerName} has secretly set the trump card 🔒`, 'info');
      });

      socket.on('blind_trump_declared', ({ message }) =>
        showNotification('🎴 ' + message, 'warning'));

      socket.on('trump_revealed', ({ symbol, suit, playedBy }) => {
        showNotification(`🃏 Trump revealed! ${playedBy} played ${symbol} — Trump is now open!`, 'warning');
      });

      socket.on('trick_complete', ({ trickWinnerTeam, trickNumber }) =>
        showNotification(`Trick ${trickNumber} → Team ${trickWinnerTeam}!`, 'success'));

    }).catch((e) => console.warn('socket.io-client load error:', e));

    return () => { try { socket?.disconnect(); } catch (_) {} };
  }, []);

  const emit = useCallback((event, data = {}) => {
    return new Promise((resolve) => {
      const s = socketRef.current;
      if (!s?.connected) {
        showError('Not connected — is the server running on port 3001?');
        return resolve({ error: 'Not connected' });
      }
      s.emit(event, data, (res) => {
        if (res?.error) showError(res.error);
        resolve(res ?? {});
      });
    });
  }, []);

  const saveSession = (persistentId, rid, name) => {
    try { localStorage.setItem('28trump_session', JSON.stringify({ persistentId, roomId: rid, playerName: name })); } catch(e) {}
  };
  const clearSession = () => { try { localStorage.removeItem('28trump_session'); } catch(e) {} };

  const createRoom = useCallback((n) => emit('create_room', { playerName: n }).then(r => {
    if (r?.success) { setRoomId(r.roomId); saveSession(r.persistentId, r.roomId, n); }
    return r;
  }), [emit]);
  const joinRoom = useCallback((id, n) => emit('join_room', { roomId: id, playerName: n }).then(r => {
    if (r?.success) { setRoomId(r.roomId); saveSession(r.persistentId, r.roomId, n); }
    return r;
  }), [emit]);
  const swapTeam           = useCallback(()    => emit('swap_team'),           [emit]);
  const startGame          = useCallback(()    => emit('start_game'),          [emit]);
  const losingTeamResponse = useCallback((w)   => emit('losing_team_response', { wantsToBid: w }), [emit]);
  const placeBid           = useCallback((v)   => emit('place_bid',            { bidValue: v }), [emit]);
  const passBid            = useCallback(()    => emit('pass_bid'),            [emit]);
  const selectTrump        = useCallback((s)   => emit('select_trump',         { suit: s }), [emit]);
  const declareBlindTrump  = useCallback(()    => emit('declare_blind_trump'), [emit]);
  const playCard           = useCallback((id)  => emit('play_card',            { cardId: id }), [emit]);
  const nextRound          = useCallback(()    => emit('next_round'),          [emit]);
  const requestMyTrump = useCallback(() => {
    return new Promise((resolve) => {
      const s = socketRef.current;
      console.log('requestMyTrump called, socket connected:', s?.connected);
      if (!s?.connected) return resolve({ error: 'Not connected' });
      s.emit('request_my_trump', {}, (res) => {
        console.log('request_my_trump server response:', res);
        resolve(res ?? {});
      });
    });
  }, []);

  return {
    connected, playerId, roomId,
    lobbyState, gameState, myHand,
    notification, error,
    createRoom, joinRoom, swapTeam, startGame, requestMyTrump,
    losingTeamResponse, placeBid, passBid,
    selectTrump, declareBlindTrump, playCard, nextRound,
  };
}
