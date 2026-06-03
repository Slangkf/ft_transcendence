// Human-readable ABI for the TournamentScores contract (ethers v6).
// Must stay in sync with blockchain/contracts/TournamentScores.sol.
export const TournamentScoresAbi = [
  "function owner() view returns (address)",
  "function recordTournament(bytes32 id, string winner, string[] nicknames, uint256[] scores, uint8[] ranks)",
  "function getTournament(bytes32 id) view returns (uint64 finishedAt, string winner, tuple(string nickname, uint256 score, uint8 rank)[] players)",
  "function isRecorded(bytes32 id) view returns (bool)",
  "function tournamentCount() view returns (uint256)",
  "event TournamentRecorded(bytes32 indexed id, string winner, uint256 playerCount)",
];
