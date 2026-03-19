// ============================================================
// ROOM MANAGER
// Handles lobby, player assignment, team formation
// ============================================================

const { randomUUID } = require('crypto');
const { GameEngine } = require('./GameEngine');

class Room {
  constructor(hostId, hostName) {
    this.roomId = this._generateCode();
    this.hostId = hostId;
    this.players = []; // max 4
    this.status = 'LOBBY'; // LOBBY | PLAYING | FINISHED
    this.engine = null;
    this.createdAt = Date.now();

    this.addPlayer(hostId, hostName);
  }

  // ─────────────────────────────────────────────
  // PLAYER MANAGEMENT
  // ─────────────────────────────────────────────
  addPlayer(playerId, playerName) {
    if (this.players.length >= 4) {
      return { error: 'Room is full (max 4 players)' };
    }
    if (this.players.find((p) => p.id === playerId)) {
      return { error: 'Player already in room' };
    }

    const position = this.players.length;
    // Auto-assign teams: positions 0,2 = Team A, positions 1,3 = Team B
    const team = position % 2 === 0 ? 'A' : 'B';

    this.players.push({
      id: playerId,          // current socket.id — changes on reconnect
      persistentId: randomUUID(), // stable across reconnects — saved in client localStorage
      name: playerName,
      team,
      position,
      connected: true,
    });

    return { success: true, player: this.players[this.players.length - 1] };
  }

  removePlayer(playerId) {
    const player = this.players.find((p) => p.id === playerId);
    if (player) {
      player.connected = false;
    }
  }

  reconnectPlayer(playerId) {
    const player = this.players.find((p) => p.id === playerId);
    if (player) {
      player.connected = true;
      return true;
    }
    return false;
  }

  // Allow team swap before game starts
  swapTeam(playerId) {
    if (this.status !== 'LOBBY') return { error: 'Cannot swap teams during game' };
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return { error: 'Player not found' };

    // Switch team
    player.team = player.team === 'A' ? 'B' : 'A';

    // Reassign positions so teams always interleave: A=0,2 and B=1,3
    const teamA = this.players.filter(p => p.team === 'A');
    const teamB = this.players.filter(p => p.team === 'B');
    [0, 1].forEach(i => {
      if (teamA[i]) teamA[i].position = i * 2;       // A: 0, 2
      if (teamB[i]) teamB[i].position = i * 2 + 1;   // B: 1, 3
    });

    return { success: true };
  }

  // ─────────────────────────────────────────────
  // GAME LIFECYCLE
  // ─────────────────────────────────────────────
  startGame() {
    if (this.players.length < 4) {
      return { error: `Need 4 players to start. Currently: ${this.players.length}` };
    }

    const teamA = this.players.filter((p) => p.team === 'A');
    const teamB = this.players.filter((p) => p.team === 'B');

    if (teamA.length !== 2 || teamB.length !== 2) {
      return { error: 'Each team must have exactly 2 players' };
    }

    this.status = 'PLAYING';
    this.engine = new GameEngine(this.roomId, this.players);

    const state = this.engine.startNewRound();
    return { success: true, state };
  }

  startNextRound() {
    if (!this.engine) return { error: 'Game not started' };
    const state = this.engine.startNewRound();
    return { success: true, state };
  }

  // ─────────────────────────────────────────────
  // GAME ACTIONS — delegate to engine
  // ─────────────────────────────────────────────
  losingTeamResponse(playerId, wantsToBid) {
    return this.engine.losingTeamResponse(playerId, wantsToBid);
  }

  getGameStateForPlayer(playerId) {
    if (!this.engine) return null;
    return this.engine.getPublicStateForPlayer(playerId);
  }

  getTrumpSuitForPlayer(playerId) {
    if (!this.engine) return null;
    const rs = this.engine.roundState;
    if (!rs || !rs.trumpSuit) return null;
    // Only return if player truly has no lead suit cards
    const hand = rs.hands?.[playerId] || [];
    const leadSuit = rs.leadSuit;
    if (leadSuit) {
      const hasLeadSuit = hand.some(c => c.suit === leadSuit);
      if (hasLeadSuit) return { error: 'You still have lead suit cards' };
    }
    return { trumpSuit: rs.trumpSuit };
  }

  placeBid(playerId, bidValue) {
    return this.engine.placeBid(playerId, bidValue);
  }

  passBid(playerId) {
    return this.engine.passBid(playerId);
  }

  selectTrumpByPlayer(playerId, suit) {
    return this.engine.selectTrump(playerId, suit);
  }

  declareBlindTrumpByPlayer(playerId) {
    return this.engine.declareBlindTrump(playerId);
  }

  playCard(playerId, cardId) {
    return this.engine.playCard(playerId, cardId);
  }

  advanceTrick() {
    if (!this.engine) return null;
    return this.engine.advanceTrick();
  }

  placeBidJohn(playerId) {
    return this.engine.placeBidJohn(playerId);
  }

  respondMidgameJohn(playerId, acceptJohn) {
    return this.engine.respondMidgameJohn(playerId, acceptJohn);
  }

  // ─────────────────────────────────────────────
  // STATE GETTERS
  // ─────────────────────────────────────────────
  getLobbyState() {
    return {
      roomId: this.roomId,
      hostId: this.hostId,
      status: this.status,
      players: this.players,
      canStart: this.players.length === 4 &&
        this.players.filter((p) => p.team === 'A').length === 2 &&
        this.players.filter((p) => p.team === 'B').length === 2,
    };
  }

  getGameState() {
    if (!this.engine) return null;
    return this.engine._getPublicState();
  }



  getPlayerHand(playerId) {
    if (!this.engine) return [];
    return this.engine.getPlayerHand(playerId);
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────
  _getTeam(playerId) {
    const player = this.players.find((p) => p.id === playerId);
    return player?.team || null;
  }

  _generateCode() {
    // 4-digit numeric room code
    return String(Math.floor(1000 + Math.random() * 9000));
  }
}

module.exports = Room;
