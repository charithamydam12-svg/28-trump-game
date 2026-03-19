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
  JOHN_OPTION:      'JOHN_OPTION',   // after 4 tricks won by one team
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

      // Team-based bidding
      teamBids: {},            // { 'A': bidValue, 'B': bidValue }
      teamPassVotes: { A: new Set(), B: new Set() }, // players who voted pass per team
      currentBid: 21,
      biddingTeam: 'A',        // which team's turn it is to bid
      biddingComplete: false,
      winnerPlayerId: null,
      winnerTeam: null,
      targetBid: null,
      // legacy compat
      playerBids: {},
      passedPlayers: new Set(),
      bidderTurnIndex: 0,

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
      this.roundState.biddingTeam = 'A'; // Team A bids first in game 1
    } else {
      // Game 2+: winning team bids first at 21, losing team starts from 20
      const losingTeam = this._getLosingTeam();
      const winningTeam = losingTeam === 'A' ? 'B' : 'A';
      this.roundState.phase = PHASE.BIDDING;
      this.roundState.biddingTeam = winningTeam; // winning team bids first
      this.roundState.losingTeam = losingTeam;
      this.roundState.higherScoreTeam = winningTeam;
      this.roundState.winningTeamBidFirst = true; // flag: winning team gets 21, losing starts at 20
    }

    // ── Rule A: if any player has all 4 zero-point cards → draw ──
    const ZERO_POINT_RANKS = new Set(['K', 'Q']);
    for (const pid of playerIds) {
      const hand = hands[pid];
      if (hand.every(c => ZERO_POINT_RANKS.has(c.rank))) {
        const player = this.playerMap[pid];
        return this._endRoundDraw(`${player?.name || 'A player'} got all zero-point cards`);
      }
    }

    return this._getPublicState();
  }

  // ─── TEAM BIDDING ────────────────────────────────────────
  // New rule: teams bid as a unit. Each team has a "current bid slot".
  // A team bids by ONE player clicking a bid value.
  // A team passes by BOTH players clicking pass.
  // Bid goes down by exactly 1 each turn (or John=16).
  // After opponent bids X, your team can only bid X-1 (or John=16).

  placeBid(playerId, bidValue) {
    const rs = this.roundState;
    if (rs.phase !== PHASE.BIDDING) return this._error('Not in bidding phase');

    const player = this.playerMap[playerId];
    if (!player) return this._error('Player not found');
    if (player.team !== rs.biddingTeam) return this._error("Not your team's turn to bid");

    // Validate bid value
    const losingTeam = rs.losingTeam;
    const winningTeam = rs.higherScoreTeam;
    const isWinningTeam = winningTeam && player.team === winningTeam;
    const isLosingTeam = losingTeam && player.team === losingTeam;

    // Determine valid bid range
    // First bid of entire auction: winning team can bid 21, losing team starts at 20
    const noBidsYet = Object.keys(rs.teamBids).length === 0;

    if (noBidsYet) {
      // First bid is always 21 (or 20 for losing team in game 2+)
      if (rs.winningTeamBidFirst) {
        const maxFirst = (losingTeam && player.team === losingTeam) ? 20 : 21;
        if (bidValue !== maxFirst) return this._error(`First bid must be exactly ${maxFirst}`);
      } else {
        if (bidValue !== 21) return this._error('First bid must be exactly 21');
      }
    } else {
      // Subsequent bids must be exactly currentBid - 1 (or John=16 handled separately)
      if (bidValue !== rs.currentBid - 1) {
        return this._error(`Must bid exactly ${rs.currentBid - 1}`);
      }
    }

    rs.teamBids[player.team] = bidValue;
    rs.playerBids[playerId] = bidValue; // legacy compat
    rs.currentBid = bidValue;

    // Cancel John if opponent bids <= 15
    if (rs.johnActive && player.team !== rs.johnTeam) {
      rs.johnActive = false;
      rs.johnPlayerId = null;
      rs.johnTeam = null;
    }

    if (bidValue === 0) return this._endBidding(playerId);

    // Switch to other team's turn
    rs.biddingTeam = player.team === 'A' ? 'B' : 'A';
    rs.teamPassVotes[rs.biddingTeam] = new Set(); // reset pass votes
    // Clear next team's old bid so they can bid again
    delete rs.teamBids[rs.biddingTeam];

    return this._getPublicState();
  }

  placeBidJohn(playerId) {
    const rs = this.roundState;
    if (rs.phase !== PHASE.BIDDING) return this._error('Not in bidding phase');
    const player = this.playerMap[playerId];
    if (!player) return this._error('Player not found');
    if (player.team !== rs.biddingTeam) return this._error("Not your team's turn to bid");
    if (rs.johnPlayerId) return this._error('John already called');

    const JOHN_BID = 16;
    if (rs.currentBid <= 16) return this._error('John (16) is not lower than current bid');

    rs.johnPlayerId = playerId;
    rs.johnTeam = player.team;
    rs.johnActive = true;
    rs.teamBids[player.team] = JOHN_BID;
    rs.playerBids[playerId] = JOHN_BID;
    rs.currentBid = JOHN_BID;

    // Switch to opponent's turn
    rs.biddingTeam = player.team === 'A' ? 'B' : 'A';
    rs.teamPassVotes[rs.biddingTeam] = new Set();
    delete rs.teamBids[rs.biddingTeam]; // clear so they can bid again

    // Check if opponent team already both passed
    const oppTeam = rs.biddingTeam;
    const oppPlayers = this.players.filter(p => p.team === oppTeam);
    const oppBothPassed = oppPlayers.every(p => rs.teamPassVotes[oppTeam]?.has(p.id));
    if (oppBothPassed) return this._endBidding(playerId);

    return this._getPublicState();
  }

  passBid(playerId) {
    const rs = this.roundState;
    if (rs.phase !== PHASE.BIDDING) return this._error('Not in bidding phase');

    const player = this.playerMap[playerId];
    if (!player) return this._error('Player not found');
    if (player.team !== rs.biddingTeam) return this._error("Not your team's turn to bid");

    // Record this player's pass vote for their team
    if (!rs.teamPassVotes[player.team]) rs.teamPassVotes[player.team] = new Set();
    rs.teamPassVotes[player.team].add(playerId);
    rs.passedPlayers.add(playerId); // legacy

    const myTeamPlayers = this.players.filter(p => p.team === player.team);
    const myTeamBothPassed = myTeamPlayers.every(p => rs.teamPassVotes[player.team].has(p.id));

    if (!myTeamBothPassed) {
      // Only one player passed — wait for teammate (stay on same team's turn but show partial pass)
      return this._getPublicState();
    }

    // Both players on this team passed
    const oppTeam = player.team === 'A' ? 'B' : 'A';
    const hasBids = Object.keys(rs.teamBids).length > 0;

    if (!hasBids) {
      // No bids at all yet
      const oppPlayers = this.players.filter(p => p.team === oppTeam);
      const oppBothPassed = oppPlayers.every(p => rs.teamPassVotes[oppTeam]?.has(p.id));

      if (oppBothPassed) {
        // Both teams passed with no bids → check game context
        if (rs.winningTeamBidFirst) {
          // Forced: winning team gets trump at 21 + blind option
          rs.phase = PHASE.TRUMP_SELECTION;
          rs.winnerTeam = rs.higherScoreTeam;
          rs.trumpTeam = rs.higherScoreTeam;
          rs.targetBid = 21;
          rs.biddingComplete = true;
          rs.forcedTrump = true;
          rs.canDeclareBlind = true; // they get blind middle card option
          rs.trumpPickerPlayerId = null;
          rs.winnerPlayerId = null;
          return this._getPublicState();
        } else {
          // Game 1 all pass → host forced
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
      }

      // This team passed, no bids, switch to opponent
      rs.biddingTeam = oppTeam;
      // If it's the winning team that passed first, losing team starts at 20
      if (rs.winningTeamBidFirst && player.team === rs.higherScoreTeam) {
        rs.currentBid = 20; // losing team max is 20
      }
      return this._getPublicState();
    }

    // hasBids: this team passed — opponent team that bid wins
    return this._endBidding(this._getLastBidder());
  }

  // No longer needed but keep for compat
  losingTeamResponse(playerId, wantsToBid) {
    return this._getPublicState();
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
    // Find team with lowest bid, return a player from that team
    let winnerTeam = null;
    let lowestBid = Infinity;
    for (const [team, bid] of Object.entries(rs.teamBids)) {
      if (bid < lowestBid) { lowestBid = bid; winnerTeam = team; }
    }
    if (!winnerTeam) return null;
    // Return the player from that team who placed the bid
    const bidder = Object.entries(rs.playerBids).find(([pid]) => this.playerMap[pid]?.team === winnerTeam);
    return bidder ? bidder[0] : this.players.find(p => p.team === winnerTeam)?.id;
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

    // ── Rule B: if opponent team has NO trump cards at all → draw ──
    const trumpTeamPlayers = this.players.filter(p => p.team === rs.trumpTeam);
    const opponentTeamPlayers = this.players.filter(p => p.team !== rs.trumpTeam);
    const opponentHasTrump = opponentTeamPlayers.some(p =>
      (rs.hands[p.id] || []).some(c => c.suit === rs.trumpSuit)
    );
    if (!opponentHasTrump) {
      return this._endRoundDraw('Opponent team has no trump cards');
    }

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

    // Deal 3 cards to the blind picker — middle one is the reserved trump
    const remaining = [...rs.remaining];
    const pickerCards = remaining.splice(0, 3); // first 3 go to picker
    const trumpCard = pickerCards[1]; // middle card = blind trump

    // Give picker all 3 cards first (they'll have 4+3=7), then reserve middle as trump
    rs.hands[playerId] = [...(rs.hands[playerId] || []), ...pickerCards];
    // Remove the trump card from picker's hand and store as reserved
    rs.hands[playerId] = rs.hands[playerId].filter(c => c.id !== trumpCard.id);
    rs.reservedTrumpCard = { playerId, card: trumpCard };

    // Deal 3 cards to everyone else from remaining
    const otherPlayers = this.players.filter(p => p.id !== playerId).map(p => p.id);
    let idx = 0;
    for (let round = 0; round < 3; round++) {
      for (const pid of otherPlayers) {
        rs.hands[pid] = [...(rs.hands[pid] || []), remaining[idx++]];
      }
    }
    rs.remaining = remaining.slice(idx);

    rs.blindTrumpCard = trumpCard;
    rs.trumpSuit = trumpCard.suit;
    rs.trumpType = 'BLIND';
    rs.trumpRevealed = false;
    rs.phase = PHASE.PLAYING;
    rs.currentTurnPlayerId = this._getFirstLeader(playerId);

    // Rule B: check opponent has trump
    const opponentTeamPlayers = this.players.filter(p => p.team !== player.team);
    const opponentHasTrump = opponentTeamPlayers.some(p =>
      (rs.hands[p.id] || []).some(c => c.suit === rs.trumpSuit)
    );
    if (!opponentHasTrump) {
      return this._endRoundDraw('Opponent team has no trump cards');
    }

    return this._getPublicState();
  }

  // ─── MID-GAME JOHN RESPONSE (Rule B) ─────────────────────
  respondMidgameJohn(playerId, acceptJohn) {
    const rs = this.roundState;
    const johnTeam = rs.midgameJohnTeam;
    // Rebuild deciders from current player list (only trump picker)
    const trumpPicker = rs.trumpPickerPlayerId;
    const currentDeciders = [trumpPicker];
    rs.midgameJohnDeciders = currentDeciders;

    console.log('[respondMidgameJohn] playerId:', playerId, 'acceptJohn:', acceptJohn, 'trumpPicker:', trumpPicker);
    if (rs.phase !== PHASE.JOHN_OPTION) return this._error('Not in John option phase');
    if (!currentDeciders.includes(playerId)) return this._error('Only the trump picker can call John');

    rs.midgameJohnResponses[playerId] = acceptJohn;

    if (acceptJohn) {
      rs.midgameJohn = true;
      rs.phase = PHASE.PLAYING;
      // Trump picker leads next trick
      rs.currentTurnPlayerId = rs.trumpPickerPlayerId;
    } else {
      // Declined — continue normal play, last trick winner leads
      rs.midgameJohn = false;
      rs.midgameJohnTeam = null;
      rs.phase = PHASE.PLAYING;
      const lastWinnerId = [...rs.completedTricks.A, ...rs.completedTricks.B]
        .slice(-1)[0]?.winner;
      rs.currentTurnPlayerId = lastWinnerId || this.players[0].id;
    }

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
        // Trump picker is FREE to play any card — no forced trump rule
      }
    }

    // mustPlayTrump (show trump button) — no enforcement, just clear the flag
    if (rs.mustPlayTrump === playerId) {
      rs.mustPlayTrump = null;
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

    if (rs.currentTrick.length === 4) return { ...this._completeTrick(), trumpJustRevealed, playedCard: card };

    rs.currentTurnPlayerId = this._getNextPlayer(playerId);
    return { ...this._getPublicState(), trumpJustRevealed, playedCard: card };
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

    // ── Rule B: after 4 tricks, check if one team won all 4 ──
    // Skip if John A (bidding john) is already active
    if (rs.trickCount === 4 && !rs.midgameJohn && !rs.johnActive) {
      const tricksA = rs.completedTricks.A.length;
      const tricksB = rs.completedTricks.B.length;
      if (tricksA === 4 || tricksB === 4) {
        const dominantTeam = tricksA === 4 ? 'A' : 'B';
        // Only trump picker gets to decide John B (not their teammate)
        const trumpPicker = rs.trumpPickerPlayerId;
        const pickerPlayer = this.players.find(p => p.id === trumpPicker);
        // Only offer John B if the dominant team is the trump team
        if (pickerPlayer && pickerPlayer.team === dominantTeam) {
          rs.phase = PHASE.JOHN_OPTION;
          rs.midgameJohnTeam = dominantTeam;
          rs.midgameJohnDeciders = [trumpPicker]; // only trump picker decides
          rs.midgameJohnResponses = {};
          return this._getPublicState();
        }
      }
    }

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

    // ── John Rule A scoring ──
    if (rs.johnActive) {
      // John team = trump team
      const johnWon = roundWinner === undefined
        ? (opponentPoints < target ? 'trump' : 'opponent') === 'trump'
        : false;
      const trumpWon = opponentPoints < target;
      roundWinner = trumpWon ? trumpTeam : opponentTeam;
      matchPointsAwarded = 2; // John team wins → 2pts
      if (!trumpWon) matchPointsAwarded = 4; // opponent beats John → 4pts
    // ── John Rule B scoring ──
    } else if (rs.midgameJohn) {
      const johnTeam = rs.midgameJohnTeam;
      const johnWon = rs.completedTricks[johnTeam].length === 7; // won all 7
      roundWinner = johnWon ? johnTeam : (johnTeam === 'A' ? 'B' : 'A');
      matchPointsAwarded = johnWon ? 2 : 4;
    } else if (opponentPoints >= target) {
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

    // ── Calculate per-player points for MVP ──
    const playerPoints = {};
    this.players.forEach(p => { playerPoints[p.id] = 0; });
    [...rs.completedTricks.A, ...rs.completedTricks.B].forEach(trick => {
      const pts = trick.cards.reduce((s, c) => s + c.card.points, 0);
      if (playerPoints[trick.winner] !== undefined) {
        playerPoints[trick.winner] += pts;
      }
    });
    let mvpId = null, mvpPts = -1;
    Object.entries(playerPoints).forEach(([pid, pts]) => {
      if (pts > mvpPts) { mvpPts = pts; mvpId = pid; }
    });
    const mvpPlayer = this.players.find(p => p.id === mvpId);
    const mvp = mvpPlayer ? { name: mvpPlayer.name, points: mvpPts, team: mvpPlayer.team } : null;

    rs.roundResult = {
      roundPoints: rs.roundPoints,
      target,
      trumpTeam,
      opponentTeam,
      roundWinner,
      matchPointsAwarded,
      isJohn: !!(rs.johnActive || rs.midgameJohn),
      johnType: rs.johnActive ? 'bidding' : rs.midgameJohn ? 'midgame' : null,
      matchScore: { ...this.matchScore },
      matchOver: rs.phase === PHASE.MATCH_OVER,
      matchWinner: rs.phase === PHASE.MATCH_OVER
        ? (this.matchScore.A >= 12 ? 'A' : 'B') : null,
      mvp,
    };

    return { ...this._getPublicState(), roundResult: rs.roundResult };
  }

  // Draw round — both teams get 0 match points
  _endRoundDraw(reason) {
    const rs = this.roundState;
    rs.phase = PHASE.ROUND_RESULT;
    rs.trumpRevealed = true;
    rs.roundResult = {
      roundPoints: { A: 0, B: 0 },
      target: rs.targetBid || 0,
      trumpTeam: rs.trumpTeam,
      opponentTeam: rs.trumpTeam === 'A' ? 'B' : 'A',
      roundWinner: null,
      matchPointsAwarded: 0,
      isDraw: true,
      drawReason: reason,
      matchScore: { ...this.matchScore },
      matchOver: false,
      matchWinner: null,
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
        teamBids: { ...rs.teamBids },
        biddingTeam: rs.biddingTeam || 'A',
        teamPassVotes: {
          A: [...(rs.teamPassVotes?.A || [])],
          B: [...(rs.teamPassVotes?.B || [])],
        },
        playerBids: { ...rs.playerBids },
        passedPlayers: [...(rs.passedPlayers || [])],
        currentBidderPlayerId: currentBidder?.id || null,
        biddingComplete: rs.biddingComplete,
        winnerPlayerId: rs.winnerPlayerId,
        winnerTeam: rs.winnerTeam,
        targetBid: rs.targetBid,
        forcedTrump: rs.forcedTrump || false,
        isFirstBid: Object.keys(rs.teamBids || {}).length === 0,
        winningTeamBidFirst: rs.winningTeamBidFirst || false,
        losingTeam: rs.losingTeam || null,
        higherScoreTeam: rs.higherScoreTeam || null,
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
        // Show full trump card to everyone once revealed
        card: rs.trumpRevealed ? (rs.trumpCard || rs.blindTrumpCard || null) : null,
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
      mustPlayTrump: rs.mustPlayTrump || null,

      john: {
        biddingJohnActive: rs.johnActive || false,
        biddingJohnPlayerId: rs.johnPlayerId || null,
        biddingJohnTeam: rs.johnTeam || null,
        midgameJohnTeam: rs.midgameJohnTeam || null,
        midgameJohn: rs.midgameJohn || false,
        midgameJohnResponses: rs.midgameJohnResponses || {},
        midgameJohnDeciders: rs.midgameJohnTeam && rs.trumpPickerPlayerId
          ? [rs.trumpPickerPlayerId]
          : [],
      },

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
    let canPlayReservedTrump = false;
    let mustPlayReservedTrump = false;
    if (myReservedTrump && !rs.trumpRevealed && rs.phase === 'PLAYING' && rs.currentTurnPlayerId === playerId && rs.currentTrick.length > 0) {
      const hasLeadSuit = (rs.hands[playerId] || []).some(c => c.suit === rs.leadSuit);
      canPlayReservedTrump = !hasLeadSuit;
      mustPlayReservedTrump = !hasLeadSuit; // MUST play reserved trump, not any other card
    }

    return {
      ...state,
      trump: {
        ...state.trump,
        suit: trumpSuit,
        iKnowTrump: knowsTrump && rs.trumpSuit !== null,
        canPickTrump,
        myReservedTrump,
        canPlayReservedTrump,
        mustPlayReservedTrump, // client uses this to grey out all other cards
      },
    };
  }

  getPlayerHand(playerId) {
    return this.roundState?.hands?.[playerId] || [];
  }
}

module.exports = { GameEngine, PHASE };
