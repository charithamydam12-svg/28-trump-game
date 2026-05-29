// ============================================================
// MAIN SERVER — 28 Card Trump Game
// Express + Socket.io + Auth
// ============================================================

// Load .env for local development (harmless in production — Railway sets env vars directly)
try { require('dotenv').config(); } catch (e) { /* dotenv not installed in prod, that's fine */ }

// Prevent DB hiccups from crashing the server
process.on('unhandledRejection', (reason) => {
  console.error('⚠️  Unhandled Promise Rejection:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️  Uncaught Exception:', err.message);
});

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Room = require('./game/Room');
const db = require('./db');
const auth = require('./auth');

const app = express();
app.use(express.json());
const httpServer = createServer(app);

const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || '*';

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['polling', 'websocket'],
  pingTimeout: 120000,
  pingInterval: 30000,
  upgradeTimeout: 30000,
  allowUpgrades: true,
});

// Also set CORS headers on express for polling fallback
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
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

// ─── STAT TRACKING ──────────────────────────────
// NOTE: games_played is incremented per ROUND (not per match-series start)
// so it matches games_won meaningfully.

async function trackRoundEnd(room, roundResult) {
  if (!roundResult) return;
  // Skip draws — neither team played a "real" winnable round
  if (roundResult.isDraw) return;
  try {
    // Increment games_played for ALL logged-in players in this round
    for (const p of room.players) {
      if (p.userId) await db.incrementStat(p.userId, 'games_played');
    }
    // MVP
    if (roundResult.mvp) {
      const mvpPlayer = room.players.find(p => p.name === roundResult.mvp.name && p.team === roundResult.mvp.team);
      if (mvpPlayer?.userId) await db.incrementStat(mvpPlayer.userId, 'mvp_count');
    }
    // Round win
    if (roundResult.roundWinner) {
      const winners = room.players.filter(p => p.team === roundResult.roundWinner && p.userId);
      for (const p of winners) await db.incrementStat(p.userId, 'games_won');
    }
    // Series win (matchOver = first to 12)
    if (roundResult.matchOver && roundResult.matchWinner) {
      const seriesWinners = room.players.filter(p => p.team === roundResult.matchWinner && p.userId);
      for (const p of seriesWinners) await db.incrementStat(p.userId, 'series_won');
    }
  } catch(e) { console.error('round stat error:', e.message); }
}

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// AUTH ROUTES (REST)
// ─────────────────────────────────────────────
app.post('/api/signup', async (req, res) => {
  try {
    const { name, username, mobile, password } = req.body;
    if (!name || !username || !mobile || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }
    if (password.length < 4) return res.status(400).json({ error: 'Password too short (min 4 chars)' });
    if (username.length < 3) return res.status(400).json({ error: 'Username too short (min 3 chars)' });
    if (!/^\d{6,15}$/.test(mobile)) return res.status(400).json({ error: 'Invalid mobile number' });

    const passwordHash = await auth.hashPassword(password);
    const user = await db.createUser({ name, username, mobile, passwordHash });
    const token = auth.generateToken(user.id);
    res.json({ token, user });
  } catch (err) {
    if (err.code === '23505') {
      const which = err.detail?.includes('username') ? 'Username' : 'Mobile';
      return res.status(409).json({ error: `${which} already exists` });
    }
    console.error('signup error:', err);
    // Surface DB connection issues clearly
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: 'Database not configured (DATABASE_URL missing)' });
    }
    res.status(500).json({ error: `Server error: ${err.message}` });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'Login & password required' });
    const user = await db.findUserByLogin(login);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await auth.verifyPassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = auth.generateToken(user.id);
    delete user.password_hash;
    res.json({ token, user });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/me', auth.authMiddleware, async (req, res) => {
  const user = await db.findUserById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

app.put('/api/profile', auth.authMiddleware, async (req, res) => {
  try {
    const { name, username, mobile, password } = req.body;
    const updates = { name, username, mobile };
    if (password) updates.passwordHash = await auth.hashPassword(password);
    const user = await db.updateUser(req.userId, updates);
    res.json({ user });
  } catch (err) {
    if (err.code === '23505') {
      const which = err.detail?.includes('username') ? 'Username' : 'Mobile';
      return res.status(409).json({ error: `${which} already in use` });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const players = await db.getLeaderboard(50);
    res.json({ players });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────
// SOCKET.IO EVENTS
// ─────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`✅ Connected: ${socket.id}`);

  // ── CREATE ROOM ──────────────────────────────
  socket.on('create_room', ({ playerName, userId }, callback) => {
    try {
      const room = new Room(socket.id, playerName, userId);
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
    io.to(roomId).emit('player_reconnected', { playerName: player.name });
    emitLobby(roomId);
    emitGameState(roomId);
  });

  // ── JOIN ROOM ─────────────────────────────────
  socket.on('join_room', ({ roomId, playerName, userId }, callback) => {
    try {
      const room = getRoom(roomId.trim());
      if (!room) return callback({ error: 'Room not found' });
      if (room.status === 'PLAYING') return callback({ error: 'Game already started' });

      const result = room.addPlayer(socket.id, playerName, userId);
      if (result.error) return callback(result);

      result.player.socketId = socket.id;
      playerRooms.set(socket.id, roomId.trim());
      socket.join(roomId.trim());

      console.log(`👤 ${playerName} joined room ${roomId}`);
      callback({ success: true, roomId: roomId.trim(), playerId: socket.id, persistentId: result.player.persistentId });
      emitLobby(roomId.trim());
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
    const extra = result.roundResult ? { roundResult: result.roundResult } : {};
    if (result.roundResult) trackRoundEnd(room, result.roundResult);
    emitGameState(roomId, extra);
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
  // ── JOHN BID ──────────────────────────────────
  socket.on('place_bid_john', (_, callback) => {
    try {
      const roomId = playerRooms.get(socket.id);
      const room = getRoom(roomId);
      if (!room) return callback({ error: 'Not in a room' });
      console.log('[place_bid_john] socket:', socket.id, 'room:', roomId);
      const result = room.placeBidJohn(socket.id);
      console.log('[place_bid_john] result:', JSON.stringify(result?.error || 'ok'));
      if (result.error) return callback({ error: result.message || result.error });
      callback({ success: true });
      emitGameState(roomId);
    } catch(e) {
      console.error('[place_bid_john] ERROR:', e.message, e.stack);
      callback({ error: e.message });
    }
  });

  // ── MID-GAME JOHN RESPONSE ────────────────────
  socket.on('respond_midgame_john', ({ acceptJohn }, callback) => {
    const roomId = playerRooms.get(socket.id);
    const room = getRoom(roomId);
    if (!room) return callback({ error: 'Not in a room' });
    const result = room.respondMidgameJohn(socket.id, acceptJohn);
    if (result.error) return callback(result);
    callback({ success: true });

    // Notify all players of the John decision
    const player = room.players.find(p => p.id === socket.id);
    io.to(roomId).emit('john_decision', {
      playerName: player?.name || 'A player',
      accepted: acceptJohn,
    });

    emitGameState(roomId);
  });

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
    const extra = result.roundResult ? { roundResult: result.roundResult } : {};
    if (result.roundResult) trackRoundEnd(room, result.roundResult);
    emitGameState(roomId, extra);
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
    const extra = result.roundResult ? { roundResult: result.roundResult } : {};
    if (result.roundResult) trackRoundEnd(room, result.roundResult);
    emitGameState(roomId, extra);
  });

  // ── PLAY CARD ─────────────────────────────────
  socket.on('play_card', ({ cardId }, callback) => {
    const roomId = playerRooms.get(socket.id);
    const room = getRoom(roomId);
    if (!room) return callback({ error: 'Not in a room' });

    const result = room.playCard(socket.id, cardId);
    if (result.error) return callback(result);

    // Emit trump_revealed BEFORE callback so all players (including picker) see the flash
    const rs = room.engine?.roundState;
    if (result.trumpJustRevealed && rs?.trumpSuit) {
      const sym = { spades:'♠', hearts:'♥', diamonds:'♦', clubs:'♣' };
      const player = room.players.find(p => p.id === socket.id);
      const playedCard = result.playedCard || rs.trumpCard || rs.blindTrumpCard || null;
      io.to(roomId).emit('trump_revealed', {
        suit: rs.trumpSuit,
        symbol: sym[rs.trumpSuit],
        playedBy: player?.name || 'A player',
        card: playedCard,
      });
    }

    callback({ success: true });

    if (result.trickResult) {
      // Phase is now TRICK_RESULT — emit state WITH all 4 cards visible
      io.to(roomId).emit('trick_complete', result.trickResult);
      emitGameState(roomId);

      // After 2s delay, advance to next trick and emit new state
      setTimeout(() => {
        const advRoom = getRoom(roomId);
        if (!advRoom) return;
        const advResult = advRoom.advanceTrick();
        if (!advResult) return;
        const extra = advResult.roundResult ? { roundResult: advResult.roundResult } : {};
        if (advResult.roundResult) trackRoundEnd(advRoom, advResult.roundResult);
        emitGameState(roomId, extra);
      }, 5000); // 5s trick display delay
    } else {
      const extra = result.roundResult ? { roundResult: result.roundResult } : {};
      emitGameState(roomId, extra);
    }
  });

  // ── NEXT ROUND ────────────────────────────────
  socket.on('end_game', (_, callback) => {
    const roomId = playerRooms.get(socket.id);
    const room = getRoom(roomId);
    if (!room) return callback?.({ error: 'Not in a room' });
    if (room.hostId !== socket.id) return callback?.({ error: 'Only host can end the game' });

    // Notify all players
    io.to(roomId).emit('game_ended', { message: 'Host ended the game' });

    // Clear the room engine so everyone goes home
    room.engine = null;
    room.status = 'WAITING';
    playerRooms.forEach((rid, pid) => {
      if (rid === roomId) playerRooms.delete(pid);
    });
    rooms.delete(roomId);
    console.log(`🛑 Host ended game in room ${roomId}`);
    callback?.({ success: true });
  });

  socket.on('exit_room', (_, callback) => {
    const roomId = playerRooms.get(socket.id);
    const room = getRoom(roomId);
    if (room) {
      const player = room.players.find(p => p.id === socket.id);
      const name = player?.name || 'A player';
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.engine?.playerMap) delete room.engine.playerMap[socket.id];
      playerRooms.delete(socket.id);
      socket.leave(roomId);
      io.to(roomId).emit('player_disconnected', { playerId: socket.id, playerName: name, permanent: true });
      emitLobby(roomId);
      emitGameState(roomId);
    }
    if (callback) callback({ success: true });
  });

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
    const extra = result.roundResult ? { roundResult: result.roundResult } : {};
    if (result.roundResult) trackRoundEnd(room, result.roundResult);
    emitGameState(roomId, extra);
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

    // Player who showed trump MUST play a trump card next
    rs.mustPlayTrump = socket.id;

    // Merge reserved trump card back into picker's hand — trump is no longer hidden
    if (rs.reservedTrumpCard) {
      const { playerId: pickerId, card: reservedCard } = rs.reservedTrumpCard;
      rs.hands[pickerId] = [...(rs.hands[pickerId] || []), reservedCard];
      rs.reservedTrumpCard = null;
    }

    const SYMS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
    const player = room.players.find(p => p.id === socket.id);

    callback({ success: true, trumpSuit: rs.trumpSuit, trumpCard: rs.trumpCard || rs.blindTrumpCard || null });

    // Broadcast reveal to everyone
    io.to(roomId).emit('trump_revealed', {
      suit: rs.trumpSuit,
      symbol: SYMS[rs.trumpSuit],
      playedBy: player?.name || 'A player',
      card: rs.trumpCard || rs.blindTrumpCard || null,
    });
    emitGameState(roomId);
  });

  // ── DISCONNECT ────────────────────────────────
  socket.on('disconnect', () => {
    const roomId = playerRooms.get(socket.id);
    if (roomId) {
      const room = getRoom(roomId);
      if (room) {
        const disconnectedId = socket.id;
        const disconnectedPlayer = room.players.find(p => p.id === disconnectedId);
        const disconnectedName = disconnectedPlayer?.name || 'A player';

        room.removePlayer(disconnectedId); // marks connected: false
        console.log(`⏳ Disconnected (grace period): ${disconnectedId} from room ${roomId}`);

        // Immediately tell everyone this player went offline
        io.to(roomId).emit('player_disconnected', {
          playerId: disconnectedId,
          playerName: disconnectedName,
        });
        emitLobby(roomId);
        emitGameState(roomId); // refresh so connected:false shows in UI

        // After 5 minutes, if still disconnected, permanently remove
        setTimeout(() => {
          const player = room.players.find(p => p.id === disconnectedId);
          if (player && !player.connected) {
            console.log(`❌ Permanently removed: ${disconnectedId}`);
            room.players = room.players.filter(p => p.id !== disconnectedId);
            if (room.engine?.playerMap) delete room.engine.playerMap[disconnectedId];
            playerRooms.delete(disconnectedId);
            emitLobby(roomId);
            emitGameState(roomId);
          }
        }, 300000); // 5 minutes grace period

        // If it's this player's turn during a game, auto-skip after 2 minutes
        const rs = room.engine?.roundState;
        if (rs?.phase === 'PLAYING' && rs.currentTurnPlayerId === disconnectedId) {
          console.log(`⏭ Scheduling auto-skip for disconnected player ${disconnectedId}`);
          setTimeout(() => {
            const stillDisconnected = room.players.find(p => p.id === disconnectedId && !p.connected);
            if (!stillDisconnected) return;
            const currentRs = room.engine?.roundState;
            if (currentRs?.currentTurnPlayerId !== disconnectedId) return;
            const eng = room.engine;
            currentRs.currentTurnPlayerId = eng._getNextPlayer(disconnectedId);
            console.log(`⏭ Auto-skipped turn for ${disconnectedId}`);
            emitGameState(roomId);
          }, 120000); // 2 minute auto-skip
        }
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
httpServer.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 28 Trump Game Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready`);
  await db.initDatabase();
});
