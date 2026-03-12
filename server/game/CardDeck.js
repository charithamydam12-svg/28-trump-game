// ============================================================
// CARD DECK ENGINE
// 28-Card Trump Game
// Suits: ♠ ♥ ♦ ♣  |  7 cards per suit = 28 total
// Rank order: 6 > J > 9 > A > 10 > K > Q
// Points: 6=4, J=3, 9=2, A=1, 10=1, K=0, Q=0
// ============================================================

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const SUIT_SYMBOLS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

// Rank order index (lower index = higher rank in trump suit)
const RANKS = ['6', 'J', '9', 'A', '10', 'K', 'Q'];

const RANK_POINTS = {
  '6':  4,
  'J':  3,
  '9':  2,
  'A':  1,
  '10': 1,
  'K':  0,
  'Q':  0,
};

// Rank order for comparisons (0 = strongest)
const RANK_ORDER = {
  '6':  0,
  'J':  1,
  '9':  2,
  'A':  3,
  '10': 4,
  'K':  5,
  'Q':  6,
};

/**
 * Create a full 28-card deck
 */
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${rank}_${suit}`,
        rank,
        suit,
        symbol: SUIT_SYMBOLS[suit],
        points: RANK_POINTS[rank],
        rankOrder: RANK_ORDER[rank],
      });
    }
  }
  return deck;
}

/**
 * Shuffle deck using Fisher-Yates algorithm
 */
function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Deal first 4 cards to each of 4 players
 * Returns { hands: {p1:[],p2:[],p3:[],p4:[]}, remaining: [...] }
 */
function dealFirstFour(deck, playerIds) {
  const hands = {};
  playerIds.forEach((id) => (hands[id] = []));

  let index = 0;
  // Deal 4 cards to each player
  for (let round = 0; round < 4; round++) {
    for (const id of playerIds) {
      hands[id].push(deck[index++]);
    }
  }

  return {
    hands,
    remaining: deck.slice(index), // 12 remaining cards
  };
}

/**
 * Deal next 3 cards to each player (after trump selection)
 */
function dealNextThree(remaining, hands, playerIds) {
  let index = 0;
  const newHands = { ...hands };
  playerIds.forEach((id) => {
    newHands[id] = [...newHands[id]];
  });

  for (let round = 0; round < 3; round++) {
    for (const id of playerIds) {
      newHands[id].push(remaining[index++]);
    }
  }

  return newHands;
}

/**
 * Get blind middle trump card from remaining 12 cards
 * Takes first 3 of remaining, middle (index 1) = trump card
 */
function getBlindMiddleTrump(remaining) {
  const blindThree = remaining.slice(0, 3);
  const trumpCard = blindThree[1]; // middle card
  return {
    blindCards: blindThree,
    trumpCard,
    trumpSuit: trumpCard.suit,
  };
}

/**
 * Get total points of a hand (for checking weak/strong hands)
 */
function getHandPoints(hand) {
  return hand.reduce((sum, card) => sum + card.points, 0);
}

/**
 * Determine trick winner
 * leadSuit = suit of the first card played
 * trumpSuit = current trump suit (null if blind and not yet revealed)
 */
function determineTrickWinner(trick, leadSuit, trumpSuit) {
  // trick = [{ playerId, card }, ...]
  let winner = trick[0];

  for (let i = 1; i < trick.length; i++) {
    const challenger = trick[i];
    winner = compareCards(winner, challenger, leadSuit, trumpSuit);
  }

  return winner.playerId;
}

/**
 * Compare two played cards — returns the stronger one
 */
function compareCards(a, b, leadSuit, trumpSuit) {
  const aIsTrump = trumpSuit && a.card.suit === trumpSuit;
  const bIsTrump = trumpSuit && b.card.suit === trumpSuit;
  const aIsLead = a.card.suit === leadSuit;
  const bIsLead = b.card.suit === leadSuit;

  // Trump beats non-trump
  if (aIsTrump && !bIsTrump) return a;
  if (bIsTrump && !aIsTrump) return b;

  // Both trump — higher trump rank wins (lower rankOrder = stronger)
  if (aIsTrump && bIsTrump) {
    return a.card.rankOrder < b.card.rankOrder ? a : b;
  }

  // Neither trump — lead suit beats off-suit
  if (aIsLead && !bIsLead) return a;
  if (bIsLead && !aIsLead) return b;

  // Both lead suit — higher rank wins
  if (aIsLead && bIsLead) {
    return a.card.rankOrder < b.card.rankOrder ? a : b;
  }

  // Both off-suit — first played stays
  return a;
}

/**
 * Calculate total card points in a set of tricks
 */
function calculateTrickPoints(tricks) {
  return tricks.reduce((sum, trick) => {
    return sum + trick.cards.reduce((s, c) => s + c.card.points, 0);
  }, 0);
}

module.exports = {
  SUITS,
  SUIT_SYMBOLS,
  RANKS,
  RANK_POINTS,
  RANK_ORDER,
  createDeck,
  shuffleDeck,
  dealFirstFour,
  dealNextThree,
  getBlindMiddleTrump,
  getHandPoints,
  determineTrickWinner,
  calculateTrickPoints,
};
