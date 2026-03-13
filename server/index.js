// ============================================================
// MAIN SERVER — 28 Card Trump Game
// Express + Socket.io
// ============================================================

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Room = require('./game/Room');

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || '*';

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Also set CORS headers on express for polling fallback
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────
// IN-MEMORY STORE
// Replace with MongoDB/Firebase for persistence
// ─────────────────────────────────────────────
const rooms = new Map();        // roomId → Room instance
const playerRooms = new Map();  // socketId → roomId

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function getRoom(roomId) {
  return rooms.get(roomId);
}

function emitGameState(roomId, extraData = {}) {
  const room = getRoom(roomId);
  if (!room || !room.engine) return; // no game started yet — don't send null game state

  // Send each player their OWN personalised state:
  // - their private hand (only their cards)
  // - trump suit only if they are the picker (or after reveal)
  room.players.forEach((player) => {
    const playerState = room.getGameStateForPlayer(player.id);
    const hand = room.getPlayerHand(player.id);
    io.to(player.id).emit('game_state', {
      ...playerState,
      ...extraData,
      myHand: hand,
    });
  });
}

function emitLobby(roomId) {
  const room = getRoom(roomId);
  if (!room) return;
  io.to(roomId).emit('lobby_state', room.getLobbyState());
}

// ─────────────────────────────────────────────
// SOCKET.IO EVENTS
// ─────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`✅ Connected: ${socket.id}`);

  // ── CREATE ROOM ──────────────────────────────
  socket.on('create_room', ({ playerName }, callback) => {
    try {
      const room = new Room(socket.id, playerName);
      room.players[0].socketId = socket.id;

      rooms.set(room.roomId, room);
      playerRooms.set(socket.id, room.roomId);

      socket.join(room.roomId);

      console.log(`🏠 Room created: ${room.roomId} by ${playerName}`);
      callback({ success: true, roomId: room.roomId, playerId: socket.id, persistentId: room.players[0].persistentId });
      emitLobby(room.roomId);
    } catch (e) {
      callback({ error: e.message });
    }
  });

  // ── REJOIN ROOM (page reload / reconnect) ─────
  socket.on('rejoin_room', ({ roomId, persistentId, playerName }, callback) => {
    console.log(`🔄 rejoin_room attempt: room=${roomId} persistentId=${persistentId} name=${playerName}`);
    const room = getRoom(roomId);
    if (!room) { console.log('❌ rejoin: room not found'); return callback({ error: 'Room not found' }); }

    const player = room.players.find(p => p.persistentId === persistentId);
    if (!player) { console.log('❌ rejoin: player not found, persistentIds:', room.players.map(p=>p.persistentId)); return callback({ error: 'Player not found in room' }); }

    const oldId = player.id;
    player.id = socket.id;
    player.connected = true;

    // Update engine references
    if (room.engine) {
      const eng = room.engine;
      if (eng.playerMap?.[oldId]) { eng.playerMap[socket.id] = eng.playerMap[oldId]; delete eng.playerMap[oldId]; eng.playerMap[socket.id].id = socket.id; }
      if (eng.players) { const ep = eng.players.find(p => p.id === oldId); if (ep) ep.id = socket.id; }
      const rs = eng.roundState;
      if (rs) {
        if (rs.hands?.[oldId])                         { rs.hands[socket.id] = rs.hands[oldId]; delete rs.hands[oldId]; }
        if (rs.playerBids?.[oldId] !== undefined)      { rs.playerBids[socket.id] = rs.playerBids[oldId]; delete rs.playerBids[oldId]; }
        if (rs.passedPlayers?.has(oldId))              { rs.passedPlayers.delete(oldId); rs.passedPlayers.add(socket.id); }
        if (rs.currentTurnPlayerId === oldId)            rs.currentTurnPlayerId = socket.id;
        if (rs.winnerPlayerId === oldId)                 rs.winnerPlayerId = socket.id;
        if (rs.trumpPickerPlayerId === oldId)            rs.trumpPickerPlayerId = socket.id;
        if (rs.reservedTrumpCard?.playerId === oldId)    rs.reservedTrumpCard.playerId = socket.id;
        if (rs.losingTeamResponses?.[oldId] !== undefined) { rs.losingTeamResponses[socket.id] = rs.losingTeamResponses[oldId]; delete rs.losingTeamResponses[oldId]; }
        if (rs.currentTrick) rs.currentTrick.forEach(t => { if (t.playerId === oldId) t.playerId = socket.id; });
      }
    }

    if (room.hostId === oldId) room.hostId = socket.id;
    playerRooms.delete(oldId);
    playerRooms.set(socket.id, roomId);
    socket.join(roomId);

    const isHost = room.hostId === socket.id;
    console.log(`✅ Rejoined: ${player.name} (${oldId} → ${socket.id}) host=${isHost}`);
    callback({ success: true, playerId: socket.id, persistentId, roomId, isHost, playerName: player.name });
    emitLobby(roomId);
    emitGameState(roomId);
  });

  // ── JOIN ROOM ─────────────────────────────────
  socket.on('join_room', ({ roomId, playerName }, callback) => {
    try {
      const room = getRoom(roomId.toUpperCase());
      if (!room) return callback({ error: 'Room not found' });
      if (room.status === 'PLAYING') return callback({ error: 'Game already started' });

      const result = room.addPlayer(socket.id, playerName);
      if (result.error) return callback(result);

      result.player.socketId = socket.id;
      playerRooms.set(socket.id, roomId.toUpperCase());
      socket.join(roomId.toUpperCase());

      console.log(`👤 ${playerName} joined room ${roomId}`);
      callback({ success: true, roomId: roomId.toUpperCase(), playerId: socket.id, persistentId: result.player.persistentId });
      emitLobby(roomId.toUpperCase());
    } catch (e) {
      callback({ error: e.message });
    }
  });

  // ── SWAP TEAM ─────────────────────────────────
  socket.on('swap_team', (_, callback) => {
    const roomId = playerRooms.get(socket.id);
    const room = getRoom(roomId);
    if (!room) return callback({ error: 'Not in a room' });

    const result = room.swapTeam(socket.id);
    if (result.error) return callback(result);

    callback({ success: true });
    emitLobby(roomId);
  });

  // ── START GAME ────────────────────────────────
  socket.on('start_game', (_, callback) => {
    const roomId = playerRooms.get(socket.id);
    const room = getRoom(roomId);
    if (!room) return callback({ error: 'Not in a room' });
    if (room.hostId !== socket.id) return callback({ error: 'Only host can start game' });

    const result = room.startGame();
    if (result.error) return callback(result);

    console.log(`🎮 Game started in room ${roomId}`);
    callback({ success: true });
    emitGameState(roomId);
  });

  // ── LOSING TEAM RESPONSE ──────────────────────
  socket.on('losing_team_response', ({ wantsToBid }, callback) => {
    const roomId = playerRooms.get(socket.id);
    const room = getRoom(roomId);
    if (!room) return callback({ error: 'Not in a room' });

    const result = room.losingTeamResponse(socket.id, wantsToBid);
    if (result.error) return callback(result);

    callback({ success: true });
    emitGameState(roomId);
  });

  // ── PLACE BID ─────────────────────────────────
  socket.on('place_bid', ({ bidValue }, callback) => {
    const roomId = playerRooms.get(socket.id);
    const room = getRoom(roomId);
    if (!room) return callback({ error: 'Not in a room' });

    const result = room.placeBid(socket.id, bidValue);
    if (result.error) return callback(result);

    callback({ success: true });
    emitGameState(roomId);
  });

  // ── PASS BID ──────────────────────────────────
  socket.on('pass_bid', (_, callback) => {
    const roomId = playerRooms.get(socket.id);
    const room = getRoom(roomId);
    if (!room) return callback({ error: 'Not in a room' });

    const result = room.passBid(socket.id);
    if (result.error) return callback(result);

    callback({ success: true });
    emitGameState(roomId);
  });

  // ── SELECT TRUMP ──────────────────────────────
  socket.on('select_trump', ({ cardId, suit }, callback) => {
    const roomId = playerRooms.get(socket.id);
    const room = getRoom(roomId);
    if (!room) return callback({ error: 'Not in a room' });

    const result = room.selectTrumpByPlayer(socket.id, suit);
    if (result.error) return callback(result);

    callback({ success: true });
    // Only broadcast the picker's name — NOT the suit (hidden from others)
    const picker = room.players.find(p => p.id === socket.id);
    io.to(roomId).emit('trump_selected', {
      pickerName: picker?.name || 'A player',
      trumpTeam: result.trump?.trumpTeam,
    });
    emitGameState(roomId);
  });

  // ── DECLARE BLIND TRUMP ───────────────────────
  socket.on('declare_blind_trump', (_, callback) => {
    const roomId = playerRooms.get(socket.id);
    const room = getRoom(roomId);
    if (!room) return callback({ error: 'Not in a room' });

    const result = room.declareBlindTrumpByPlayer(socket.id);
    if (result.error) return callback(result);

    callback({ success: true });
    io.to(roomId).emit('blind_trump_declared', {
      trumpTeam: result.trump?.trumpTeam,
      message: 'Blind trump declared! Trump suit hidden until first trump played.',
    });
    emitGameState(roomId);
  });

  // ── PLAY CARD ─────────────────────────────────
  socket.on('play_card', ({ cardId }, callback) => {
    const roomId = playerRooms.get(socket.id);
    const room = getRoom(roomId);
    if (!room) return callback({ error: 'Not in a room' });

    const result = room.playCard(socket.id, cardId);
    if (result.error) return callback(result);

    callback({ success: true });

    if (result.trickResult) {
      io.to(roomId).emit('trick_complete', result.trickResult);
    }

    // Only broadcast trump_revealed when it JUST flipped to true this move
    // Check by seeing if result contains the newly revealed state
    const gs = room.getGameState();
    if (result.trumpJustRevealed && gs?.trump?.suit) {
      const sym = { spades:'♠', hearts:'♥', diamonds:'♦', clubs:'♣' };
      const player = room.players.find(p => p.id === socket.id);
      io.to(roomId).emit('trump_revealed', {
        suit: gs.trump.suit,
        symbol: sym[gs.trump.suit],
        playedBy: player?.name || 'A player',
      });
    }

    const extra = result.roundResult ? { roundResult: result.roundResult } : {};
    emitGameState(roomId, extra);
  });

  // ── NEXT ROUND ────────────────────────────────
  socket.on('next_round', (_, callback) => {
    const roomId = playerRooms.get(socket.id);
    const room = getRoom(roomId);
    if (!room) return callback({ error: 'Not in a room' });
    if (room.hostId !== socket.id) return callback({ error: 'Only host can start next round' });

    // If match is over (Play Again), reset scores and game counter first
    const currentState = room.getGameState();
    if (currentState?.phase === 'MATCH_OVER') {
      room.engine.matchScore = { A: 0, B: 0 };
      room.engine.gameNumber = 0;
    }

    const result = room.startNextRound();
    if (result.error) return callback(result);

    callback({ success: true });
    emitGameState(roomId);
  });

  // ── REQUEST HAND ──────────────────────────────
  // Player requests their private hand (on reconnect)
  socket.on('request_hand', (_, callback) => {
    const roomId = playerRooms.get(socket.id);
    const room = getRoom(roomId);
    if (!room) return callback({ error: 'Not in a room' });

    const hand = room.getPlayerHand(socket.id);
    callback({ hand });
  });

  // ── REVEAL TRUMP TO SELF ─────────────────────────────────
  // Player has no lead suit — they click "Show Trump" to see their trump suit
  // Only sent to THIS player privately (not broadcast to room)
  socket.on('request_my_trump', (_, callback) => {
    const roomId = playerRooms.get(socket.id);
    const room = getRoom(roomId);
    if (!room) return callback({ error: 'Not in a room' });

    const rs = room.engine?.roundState;
    if (!rs?.trumpSuit) return callback({ error: 'Trump not set yet' });

    // Validate player has no lead suit cards
    const hand = room.getPlayerHand(socket.id);
    const leadSuit = rs.leadSuit;
    if (leadSuit && hand.some(c => c.suit === leadSuit)) {
      return callback({ error: 'You still have lead suit cards' });
    }

    // Reveal trump to ALL players now
    rs.trumpRevealed = true;

    // Merge reserved trump card back into picker's hand — trump is no longer hidden
    if (rs.reservedTrumpCard) {
      const { playerId: pickerId, card: reservedCard } = rs.reservedTrumpCard;
      rs.hands[pickerId] = [...(rs.hands[pickerId] || []), reservedCard];
      rs.reservedTrumpCard = null;
    }

    const SYMS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
    const player = room.players.find(p => p.id === socket.id);

    callback({ success: true, trumpSuit: rs.trumpSuit });

    // Broadcast reveal to everyone
    io.to(roomId).emit('trump_revealed', {
      suit: rs.trumpSuit,
      symbol: SYMS[rs.trumpSuit],
      playedBy: player?.name || 'A player',
    });
    emitGameState(roomId);
  });

  // ── DISCONNECT ────────────────────────────────
  socket.on('disconnect', () => {
    const roomId = playerRooms.get(socket.id);
    if (roomId) {
      const room = getRoom(roomId);
      if (room) {
        const disconnectedId = socket.id; // capture now — socket.id may remap on rejoin
        room.removePlayer(disconnectedId); // marks connected: false
        console.log(`⏳ Disconnected (grace period): ${disconnectedId} from room ${roomId}`);

        // After 30s, if still disconnected (player.id still matches — not remapped by rejoin), remove them
        setTimeout(() => {
          const player = room.players.find(p => p.id === disconnectedId);
          if (player && !player.connected) {
            console.log(`❌ Permanently removed: ${disconnectedId}`);
            room.players = room.players.filter(p => p.id !== disconnectedId);
            if (room.engine?.playerMap) delete room.engine.playerMap[disconnectedId];
            playerRooms.delete(disconnectedId);
            emitLobby(roomId);
          }
        }, 30000);

        // If it's this player's turn during a game, auto-skip after 15s
        const rs = room.engine?.roundState;
        if (rs?.phase === 'PLAYING' && rs.currentTurnPlayerId === disconnectedId) {
          console.log(`⏭ Scheduling auto-skip for disconnected player ${disconnectedId}`);
          setTimeout(() => {
            const stillDisconnected = room.players.find(p => p.id === disconnectedId && !p.connected);
            if (!stillDisconnected) return; // came back
            const currentRs = room.engine?.roundState;
            if (currentRs?.currentTurnPlayerId !== disconnectedId) return; // turn already moved
            // Skip their turn — advance to next player
            const eng = room.engine;
            currentRs.currentTurnPlayerId = eng._getNextPlayer(disconnectedId);
            console.log(`⏭ Auto-skipped turn for ${disconnectedId}`);
            io.to(roomId).emit('notification', { message: 'A player disconnected — turn skipped', type: 'warning' });
            emitGameState(roomId);
          }, 15000);
        }

        emitLobby(roomId);
      }
    }
  });
});

// ─────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    rooms: rooms.size,
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 28 Trump Game Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready`);
});
