// ============================================================
// GAME ENGINE — 28 Card Trump Game
// ============================================================

const {
  createDeck, shuffleDeck, dealFirstFour, dealNextThree,
  getBlindMiddleTrump, determineTrickWinner, calculateTrickPoints,
} = require('./CardDeck');

const PHASE = {
  WAITING:          'WAITING',
  DEAL_FIRST_FOUR:  'DEAL_FIRST_FOUR',
  BIDDING:          'BIDDING',
  ASK_LOSING_TEAM:  'ASK_LOSING_TEAM',
  TRUMP_SELECTION:  'TRUMP_SELECTION',
  BLIND_TRUMP:      'BLIND_TRUMP',
  DEAL_NEXT_THREE:  'DEAL_NEXT_THREE',
  PLAYING:          'PLAYING',
  TRICK_RESULT:     'TRICK_RESULT',
  ROUND_RESULT:     'ROUND_RESULT',
  MATCH_OVER:       'MATCH_OVER',
};

class GameEngine {
  constructor(roomId, players) {
    this.roomId = roomId;
    this.players = players;
    this.playerMap = {};
    players.forEach((p) => (this.playerMap[p.id] = p));
    this.teams = {
      A: players.filter((p) => p.team === 'A').map((p) => p.id),
      B: players.filter((p) => p.team === 'B').map((p) => p.id),
    };
    this.matchScore = { A: 0, B: 0 };
    this.gameNumber = 0;
    this.roundState = null;
  }

  // ─── START NEW ROUND ──────────────────────────────────────
  startNewRound() {
    this.gameNumber++;
    const deck = shuffleDeck(createDeck());
    const playerIds = this.players.map((p) => p.id);
    const { hands, remaining } = dealFirstFour(deck, playerIds);

    this.roundState = {
      phase: PHASE.DEAL_FIRST_FOUR,
      deck, hands, remaining,

      // Individual bidding — each player bids separately
      // bids: { playerId: number }  (only set when player bids, not when they pass)
      playerBids: {},          // { playerId: bidValue }
      passedPlayers: new Set(), // players who passed
      currentBid: 21,
      bidderTurnIndex: 0,      // index into this.players array
      biddingComplete: false,
      winnerPlayerId: null,    // player who won the bid
      winnerTeam: null,
      targetBid: null,

      // Trump — hidden from all except winner
      trumpSuit: null,
      trumpTeam: null,
      trumpPickerPlayerId: null,
      trumpType: 'NORMAL',
      blindCards: null,
      blindTrumpCard: null,
      trumpRevealed: false,    // revealed to ALL when first trump card played
      reservedTrumpCard: null, // { playerId, card } — picker's hidden trump card

      // Playing
      currentTrick: [],
      completedTricks: { A: [], B: [] },
      trickCount: 0,
      currentTurnPlayerId: null,
      leadSuit: null,
      roundPoints: { A: 0, B: 0 },
      roundResult: null,
    };

    if (this.gameNumber === 1) {
      this.roundState.phase = PHASE.BIDDING;
      this.roundState.bidderTurnIndex = 0;
    } else {
      const losingTeam = this._getLosingTeam();
      this.roundState.phase = PHASE.ASK_LOSING_TEAM;
      this.roundState.losingTeam = losingTeam;
      this.roundState.higherScoreTeam = losingTeam === 'A' ? 'B' : 'A';
    }

    return this._getPublicState();
  }

  // ─── LOSING TEAM RESPONSE (Game 2+) ──────────────────────
  // Rule: ANY player clicking YES starts bidding immediately
  //       BOTH players must click NO to force trump on winning team
  losingTeamResponse(playerId, wantsToBid) {
    const rs = this.roundState;
    if (rs.phase !== PHASE.ASK_LOSING_TEAM) return this._error('Wrong phase');

    const player = this.playerMap[playerId];
    if (!player || player.team !== rs.losingTeam) return this._error('Not on the losing team');

    // Track individual responses
    if (!rs.losingTeamResponses) rs.losingTeamResponses = {};
    rs.losingTeamResponses[playerId] = wantsToBid;

    if (wantsToBid) {
      // Any YES → start bidding immediately, this player bids first
      rs.phase = PHASE.BIDDING;
      rs.bidderTurnIndex = this.players.indexOf(player);
    } else {
      // Check if ALL losing team players have said NO
      const losingTeamPlayers = this.players.filter(p => p.team === rs.losingTeam);
      const allSaidNo = losingTeamPlayers.every(p => rs.losingTeamResponses[p.id] === false);

      if (allSaidNo) {
        // Both said NO → winning team forced to bid 21, BOTH can pick trump
        rs.phase = PHASE.TRUMP_SELECTION;
        rs.winnerTeam = rs.higherScoreTeam;
        rs.trumpTeam = rs.higherScoreTeam;
        rs.targetBid = 21;
        rs.biddingComplete = true;
        rs.forcedTrump = true;
        // trumpPickerPlayerId = null means ANY winning team player can pick
        rs.trumpPickerPlayerId = null;
        rs.winnerPlayerId = null;
      }
      // else: waiting for the other losing team player to respond
    }
    return this._getPublicState();
  }

  // ─── PLACE BID (individual player) ───────────────────────
  placeBid(playerId, bidValue) {
    const rs = this.roundState;
    if (rs.phase !== PHASE.BIDDING) return this._error('Not in bidding phase');

    const currentBidder = this.players[rs.bidderTurnIndex];
    if (currentBidder.id !== playerId) return this._error('Not your turn to bid');
    if (bidValue < 0) return this._error('Bid cannot be negative');

    const isFirstBid = Object.keys(rs.playerBids).length === 0;
    if (isFirstBid  && bidValue > rs.currentBid)  return this._error(`Opening bid cannot exceed ${rs.currentBid}`);
    if (!isFirstBid && bidValue >= rs.currentBid) return this._error(`Bid must be lower than ${rs.currentBid}`);

    rs.playerBids[playerId] = bidValue;
    rs.currentBid = bidValue;

    if (bidValue === 0) {
      return this._endBidding(playerId);
    }

    // If all other players have already passed, this player wins immediately
    const activePlayers = this.players.filter(p => !rs.passedPlayers.has(p.id));
    if (activePlayers.length === 1 && activePlayers[0].id === playerId) {
      return this._endBidding(playerId);
    }

    return this._advanceBidTurn();
  }

  // ─── PASS BID ────────────────────────────────────────────
  passBid(playerId) {
    const rs = this.roundState;
    if (rs.phase !== PHASE.BIDDING) return this._error('Not in bidding phase');

    const currentBidder = this.players[rs.bidderTurnIndex];
    if (currentBidder.id !== playerId) return this._error('Not your turn to bid');

    rs.passedPlayers.add(playerId);

    const activePlayers = this.players.filter(p => !rs.passedPlayers.has(p.id));
    const hasBids = Object.keys(rs.playerBids).length > 0;

    console.log('[passBid]', playerId, 'active:', activePlayers.length, 'hasBids:', hasBids);

    // CASE 1: All 4 passed with NO bids → host forced at 21
    if (activePlayers.length === 0 && !hasBids) {
      console.log('[passBid] All passed, no bids → force host');
      const host = this.players.find(p => p.position === 0);
      rs.phase = PHASE.TRUMP_SELECTION;
      rs.winnerPlayerId = host.id;
      rs.winnerTeam = host.team;
      rs.trumpPickerPlayerId = host.id;
      rs.trumpTeam = host.team;
      rs.targetBid = 21;
      rs.biddingComplete = true;
      rs.forcedTrump = true;
      rs.currentBid = 21;
      return this._getPublicState();
    }

    // CASE 2: All 4 passed and someone DID bid → last bidder wins
    if (activePlayers.length === 0 && hasBids) {
      const lastBidder = this._getLastBidder();
      console.log('[passBid] All passed, lastBidder wins:', lastBidder);
      return this._endBidding(lastBidder);
    }

    // CASE 3: Bids exist, only non-bidders remain active → last bidder wins
    if (hasBids) {
      const lastBidder = this._getLastBidder();
      if (lastBidder) {
        const activeBesideLastBidder = activePlayers.filter(p => p.id !== lastBidder);
        if (activeBesideLastBidder.length === 0) {
          console.log('[passBid] Only last bidder remains:', lastBidder);
          return this._endBidding(lastBidder);
        }
      }
    }

    // Otherwise: still players to go — advance turn
    console.log('[passBid] advancing turn, active players:', activePlayers.map(p=>p.name));
    return this._advanceBidTurn();
  }

  _advanceBidTurn() {
    const rs = this.roundState;
    // Skip passed players, find next active player
    let nextIndex = rs.bidderTurnIndex;
    for (let i = 1; i <= this.players.length; i++) {
      nextIndex = (rs.bidderTurnIndex + i) % this.players.length;
      if (!rs.passedPlayers.has(this.players[nextIndex].id)) break;
    }
    rs.bidderTurnIndex = nextIndex;
    return this._getPublicState();
  }

  _getLastBidder() {
    const rs = this.roundState;
    // Find the player with the lowest bid (they win the auction)
    // Include ALL bidders — even ones who later passed, since they still placed a valid bid
    let lastBidderId = null;
    let lowestBid = Infinity;
    for (const [pid, bid] of Object.entries(rs.playerBids)) {
      if (bid < lowestBid) {
        lowestBid = bid;
        lastBidderId = pid;
      }
    }
    return lastBidderId;
  }

  _endBidding(winnerPlayerId) {
    const rs = this.roundState;
    const winner = this.playerMap[winnerPlayerId];

    rs.biddingComplete = true;
    rs.winnerPlayerId = winnerPlayerId;
    rs.winnerTeam = winner.team;
    rs.trumpPickerPlayerId = winnerPlayerId;
    rs.trumpTeam = winner.team;
    // Target = opponent team must reach this score
    rs.targetBid = rs.playerBids[winnerPlayerId] ?? rs.currentBid;

    const canBlind = this._canDeclareBlindTrump(winnerPlayerId);
    rs.canDeclareBlind = canBlind;
    rs.phase = PHASE.TRUMP_SELECTION;

    return this._getPublicState();
  }

  // ─── SELECT TRUMP ─────────────────────────────────────────
  // Normal: only bid winner picks. Forced: any winning team player picks (first one wins)
  selectTrump(playerId, cardId) {
    const rs = this.roundState;
    if (rs.phase !== PHASE.TRUMP_SELECTION) return this._error('Wrong phase');

    const player = this.playerMap[playerId];
    if (rs.forcedTrump) {
      if (player.team !== rs.winnerTeam) return this._error('Only the winning team picks trump');
    } else {
      if (playerId !== rs.trumpPickerPlayerId) return this._error('Only the bid winner picks trump');
    }
    if (rs.trumpPickerPlayerId && rs.trumpPickerPlayerId !== playerId && !rs.forcedTrump) {
      return this._error('Trump already being selected');
    }

    // Find the selected card in the picker's current hand (first 4)
    const hand = rs.hands[playerId];
    const cardIndex = hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return this._error('Card not in your hand');

    const trumpCard = hand[cardIndex];

    rs.trumpPickerPlayerId = playerId;
    rs.trumpSuit = trumpCard.suit;
    rs.trumpCard = trumpCard;           // the actual reserved card
    rs.trumpType = 'NORMAL';
    rs.trumpRevealed = false;

    // Remove trump card from hand — stored separately, not playable normally
    rs.hands[playerId] = hand.filter((_, i) => i !== cardIndex);
    rs.reservedTrumpCard = { playerId, card: trumpCard }; // stored aside

    // Deal remaining 3 cards
    rs.hands = dealNextThree(rs.remaining, rs.hands, this.players.map(p => p.id));
    rs.phase = PHASE.PLAYING;

    // Game 1 (equal scores): trump picker leads
    // Game 2+: random player from winning team leads
    rs.currentTurnPlayerId = this._getFirstLeader(playerId);

    return this._getPublicState();
  }

  // ─── BLIND TRUMP ─────────────────────────────────────────
  declareBlindTrump(playerId) {
    const rs = this.roundState;
    if (rs.phase !== PHASE.TRUMP_SELECTION) return this._error('Wrong phase');
    if (!rs.canDeclareBlind) return this._error('Blind trump not available');
    const player = this.playerMap[playerId];
    if (rs.forcedTrump) {
      if (player.team !== rs.winnerTeam) return this._error('Only winning team can declare blind trump');
    } else {
      if (playerId !== rs.trumpPickerPlayerId) return this._error('Only bid winner can declare blind trump');
    }
    rs.trumpPickerPlayerId = playerId;

    const { blindCards, trumpCard, trumpSuit } = getBlindMiddleTrump(rs.remaining);
    rs.blindCards = blindCards;
    rs.blindTrumpCard = trumpCard;
    rs.trumpSuit = trumpSuit;
    rs.trumpType = 'BLIND';
    rs.trumpRevealed = false;
    rs.hands = dealNextThree(rs.remaining, rs.hands, this.players.map(p => p.id));
    rs.phase = PHASE.PLAYING;
    rs.currentTurnPlayerId = this._getFirstLeader(playerId);

    return this._getPublicState();
  }

  // ─── PLAY CARD ───────────────────────────────────────────
  playCard(playerId, cardId) {
    const rs = this.roundState;
    if (rs.phase !== PHASE.PLAYING) return this._error('Not playing phase');
    if (rs.currentTurnPlayerId !== playerId) return this._error('Not your turn');

    const hand = rs.hands[playerId];
    const reserved = rs.reservedTrumpCard;
    const isPlayingReserved = reserved && reserved.playerId === playerId && reserved.card.id === cardId;

    // Find card — either in normal hand or reserved trump card
    let card, cardIndex;
    if (isPlayingReserved) {
      card = reserved.card;
    } else {
      cardIndex = hand.findIndex(c => c.id === cardId);
      if (cardIndex === -1) return this._error('Card not in hand');
      card = hand[cardIndex];
    }

    // ── Follow-suit validation ──
    if (rs.currentTrick.length > 0) {
      const hasLeadSuit = hand.some(c => c.suit === rs.leadSuit);

      if (isPlayingReserved) {
        // Reserved trump card: can only play it if no lead-suit cards in normal hand
        if (hasLeadSuit) return this._error(`Must follow lead suit: ${rs.leadSuit}`);
      } else {
        if (hasLeadSuit && card.suit !== rs.leadSuit) {
          return this._error(`Must follow lead suit: ${rs.leadSuit}`);
        }
      }
    }

    // ── Remove card from wherever it was ──
    if (isPlayingReserved) {
      rs.reservedTrumpCard = null; // consumed
    } else {
      rs.hands[playerId] = hand.filter((_, i) => i !== cardIndex);
    }

    if (rs.currentTrick.length === 0) rs.leadSuit = card.suit;

    // ── Trump reveal logic ──
    let trumpJustRevealed = false;
    if (!rs.trumpRevealed && rs.trumpSuit && card.suit === rs.trumpSuit) {
      const isLeadCard = rs.currentTrick.length === 0;
      const leadIsTrump = rs.leadSuit === rs.trumpSuit;
      if (!isLeadCard && !leadIsTrump) {
        rs.trumpRevealed = true;
        trumpJustRevealed = true;
        // Merge reserved trump card back into picker's hand — no longer needs to be hidden
        if (rs.reservedTrumpCard) {
          const { playerId: pickerId, card: reservedCard } = rs.reservedTrumpCard;
          rs.hands[pickerId] = [...(rs.hands[pickerId] || []), reservedCard];
          rs.reservedTrumpCard = null;
        }
      }
    }

    rs.currentTrick.push({ playerId, card });

    if (rs.currentTrick.length === 4) return { ...this._completeTrick(), trumpJustRevealed };

    rs.currentTurnPlayerId = this._getNextPlayer(playerId);
    return { ...this._getPublicState(), trumpJustRevealed };
  }

  _completeTrick() {
    const rs = this.roundState;
    const winnerId = determineTrickWinner(rs.currentTrick, rs.leadSuit,
      rs.trumpRevealed ? rs.trumpSuit : null);
    const winnerTeam = this.playerMap[winnerId].team;

    rs.completedTricks[winnerTeam].push({
      cards: [...rs.currentTrick], winner: winnerId, winnerTeam,
    });

    rs.trickCount++;
    // DO NOT clear currentTrick yet — keep 4 cards visible for display delay
    rs.leadSuit = null;
    rs.lastTrickWinner = winnerId;

    const trickResult = { trickWinner: winnerId, trickWinnerTeam: winnerTeam, trickNumber: rs.trickCount };

    // Mark trick as complete but frozen — server will advance after delay
    rs.trickPending = { winnerId, isLastTrick: rs.trickCount === 7 };
    rs.phase = PHASE.TRICK_RESULT;

    return { ...this._getPublicState(), trickResult };
  }

  // Called after display delay to actually advance to next trick
  advanceTrick() {
    const rs = this.roundState;
    if (!rs.trickPending) return null;

    const { winnerId, isLastTrick } = rs.trickPending;
    rs.trickPending = null;
    rs.currentTrick = [];
    rs.lastTrickWinner = null;

    if (isLastTrick) return this._endRound();

    rs.currentTurnPlayerId = winnerId;
    rs.phase = PHASE.PLAYING;
    return this._getPublicState();
  }

  _endRound() {
    const rs = this.roundState;
    const pointsA = calculateTrickPoints(rs.completedTricks.A);
    const pointsB = calculateTrickPoints(rs.completedTricks.B);
    rs.roundPoints = { A: pointsA, B: pointsB };

    const trumpTeam = rs.trumpTeam;
    const opponentTeam = trumpTeam === 'A' ? 'B' : 'A';
    const opponentPoints = rs.roundPoints[opponentTeam];
    const target = rs.targetBid;

    let roundWinner, matchPointsAwarded;
    if (opponentPoints >= target) {
      roundWinner = opponentTeam;
      matchPointsAwarded = 2;
    } else {
      roundWinner = trumpTeam;
      matchPointsAwarded = 1;
    }

    this.matchScore[roundWinner] += matchPointsAwarded;

    rs.phase = (this.matchScore.A >= 12 || this.matchScore.B >= 12)
      ? PHASE.MATCH_OVER : PHASE.ROUND_RESULT;

    rs.trumpRevealed = true; // reveal trump at round end

    rs.roundResult = {
      roundPoints: rs.roundPoints,
      target,
      trumpTeam,
      opponentTeam,
      roundWinner,
      matchPointsAwarded,
      matchScore: { ...this.matchScore },
      matchOver: rs.phase === PHASE.MATCH_OVER,
      matchWinner: rs.phase === PHASE.MATCH_OVER
        ? (this.matchScore.A >= 12 ? 'A' : 'B') : null,
    };

    return { ...this._getPublicState(), roundResult: rs.roundResult };
  }

  // ─── HELPERS ─────────────────────────────────────────────
  _getLosingTeam() {
    if (this.matchScore.A < this.matchScore.B) return 'A';
    if (this.matchScore.B < this.matchScore.A) return 'B';
    return 'A';
  }

  _canDeclareBlindTrump(playerId) {
    if (this.gameNumber <= 1) return false;
    const player = this.playerMap[playerId];
    const higherScoreTeam = this.matchScore.A > this.matchScore.B ? 'A' : 'B';
    return player.team === higherScoreTeam;
  }

  _getFirstPlayer() {
    return this.players.find(p => p.position === 0)?.id;
  }

  _getNextPlayer(currentId) {
    const pos = this.playerMap[currentId].position;
    return this.players.find(p => p.position === (pos + 1) % 4)?.id;
  }

  // Who leads the first trick:
  // - Game 1 (scores equal 0:0): trump picker leads
  // - Game 2+: random player from the winning team (higher score) leads
  _getFirstLeader(trumpPickerId) {
    const { A, B } = this.matchScore;
    // Equal scores = game 1 or tied — trump picker leads
    if (A === B) return trumpPickerId;

    const winningTeam = A > B ? 'A' : 'B';
    const winningPlayers = this.players.filter(p => p.team === winningTeam);
    // Pick randomly between the 2 winning team players
    const leader = winningPlayers[Math.floor(Math.random() * winningPlayers.length)];
    return leader.id;
  }

  _error(msg) { return { error: true, message: msg }; }

  // ─── PUBLIC STATE ─────────────────────────────────────────
  // trumpSuit is sent PER-PLAYER: picker sees it, others see null until revealed
  _getPublicState() {
    const rs = this.roundState;
    if (!rs) return { phase: PHASE.WAITING, matchScore: this.matchScore };

    const currentBidder = this.players[rs.bidderTurnIndex];

    return {
      roomId: this.roomId,
      gameNumber: this.gameNumber,
      phase: rs.phase,
      matchScore: { ...this.matchScore },

      bidding: {
        currentBid: rs.currentBid,
        playerBids: { ...rs.playerBids },
        passedPlayers: [...(rs.passedPlayers || [])],
        currentBidderPlayerId: currentBidder?.id || null,
        biddingComplete: rs.biddingComplete,
        winnerPlayerId: rs.winnerPlayerId,
        winnerTeam: rs.winnerTeam,
        targetBid: rs.targetBid,
        forcedTrump: rs.forcedTrump || false,
        isFirstBid: Object.keys(rs.playerBids || {}).length === 0,
      },

      trump: {
        // suit: hidden from non-pickers until trumpRevealed
        // each player sees this differently — handled in getPublicStateForPlayer()
        trumpTeam: rs.trumpTeam,
        trumpType: rs.trumpType,
        revealed: rs.trumpRevealed,
        canDeclareBlind: rs.canDeclareBlind || false,
        trumpPickerPlayerId: rs.trumpPickerPlayerId,
        suitHidden: rs.trumpSuit !== null && !rs.trumpRevealed,
      },

      losingTeam: rs.losingTeam || null,
      higherScoreTeam: rs.higherScoreTeam || null,
      losingTeamResponses: rs.losingTeamResponses || {},
      hasReservedTrump: !!(rs.reservedTrumpCard) && !rs.trumpRevealed, // public: reserved and still hidden

      currentTrick: rs.currentTrick || [],
      trickCount: rs.trickCount || 0,
      currentTurnPlayerId: rs.currentTurnPlayerId,
      leadSuit: rs.leadSuit,
      lastTrickWinner: rs.lastTrickWinner || null,

      trickCounts: {
        A: rs.completedTricks?.A?.length || 0,
        B: rs.completedTricks?.B?.length || 0,
      },

      roundPoints: rs.roundPoints || { A: 0, B: 0 },
      roundResult: rs.roundResult || null,

      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        team: p.team,
        position: p.position,
        cardCount: rs.hands?.[p.id]?.length || 0,
        hasBid: rs.playerBids?.[p.id] !== undefined,
        hasPassed: rs.passedPlayers?.has(p.id) || false,
        bidValue: rs.playerBids?.[p.id],
        connected: p.connected !== false, // true unless explicitly false
      })),
    };
  }

  // Per-player state — trump suit only visible to picker (or all after reveal)
  getPublicStateForPlayer(playerId) {
    const state = this._getPublicState();
    const rs = this.roundState;
    if (!rs) return state;

    const player = this.playerMap[playerId];
    const isPicker = playerId === rs.trumpPickerPlayerId;
    const isForcedWinner = rs.forcedTrump && player?.team === rs.winnerTeam;
    const knowsTrump = isPicker || (isForcedWinner && rs.trumpSuit !== null && rs.trumpPickerPlayerId === playerId);
    const trumpSuit = rs.trumpRevealed || knowsTrump ? rs.trumpSuit : null;

    const canPickTrump = rs.phase === 'TRUMP_SELECTION' && (
      rs.forcedTrump
        ? player?.team === rs.winnerTeam && !rs.trumpSuit
        : playerId === rs.trumpPickerPlayerId
    );

    // Reserved trump card — only visible to the picker, and only while trump is still hidden
    const myReservedTrump = (rs.reservedTrumpCard && rs.reservedTrumpCard.playerId === playerId && !rs.trumpRevealed)
      ? rs.reservedTrumpCard.card
      : null;

    // Can picker play their reserved trump card right now?
    // Yes if: trump still hidden, it's their turn, trick in progress, no lead-suit cards in normal hand
    let canPlayReservedTrump = false;
    if (myReservedTrump && !rs.trumpRevealed && rs.phase === 'PLAYING' && rs.currentTurnPlayerId === playerId && rs.currentTrick.length > 0) {
      const hasLeadSuit = (rs.hands[playerId] || []).some(c => c.suit === rs.leadSuit);
      canPlayReservedTrump = !hasLeadSuit;
    }

    return {
      ...state,
      trump: {
        ...state.trump,
        suit: trumpSuit,
        iKnowTrump: knowsTrump && rs.trumpSuit !== null,
        canPickTrump,
        myReservedTrump,       // the actual card object, only for picker
        canPlayReservedTrump,  // whether picker can play it now
      },
    };
  }

  getPlayerHand(playerId) {
    return this.roundState?.hands?.[playerId] || [];
  }
}

module.exports = { GameEngine, PHASE };
