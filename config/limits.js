// config/limits.js
//
// Single source of truth for free-tier quantities. Change these numbers to
// tune how much a user gets before they must verify a card / buy tokens.
// Read everywhere via this module — never hardcode a free-tier number in a
// route or component.
//
// The funnel (thecv.pro):
//   1. Free job match & analysis        -> FREE_ANALYSES
//   2. Account creation                 -> (no cost)
//   3. One free CV & cover written       -> FREE_GENERATIONS
//   4. See & tune candidate core + doc guidance (no cost)
//   5. Verify a card (no charge)         -> unlocks FREE_DOWNLOADS
//   6. Further CVs/covers                -> paid tokens

export const LIMITS = {
  // Analyses a user may run for free. null = unlimited.
  FREE_ANALYSES: null,

  // Free CV + cover generations granted to a new account (the "generations_left" seed).
  // 2 = one free CV AND one free cover (each document costs one write).
  FREE_GENERATIONS: 2,

  // Free document downloads unlocked once a card is on file (no charge taken).
  FREE_DOWNLOADS: 1,

  // Paid token balance a brand-new account starts with. 0 = must verify/buy.
  STARTING_TOKENS: 0,
};
