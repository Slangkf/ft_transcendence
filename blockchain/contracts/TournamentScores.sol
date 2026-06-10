// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TournamentScores
/// @notice Stores ft_transcendence tournament results on-chain.
/// @dev Immutability is guaranteed by the "write once" rule: a tournament id
///      can only ever be recorded a single time, and no function can mutate or
///      delete an existing record afterwards.
contract TournamentScores {
    address public owner;

    struct PlayerScore {
        string nickname;
        uint256 score; // domain score (e.g. correct answers)
        uint8 rank;     // 1 = champion
    }

    struct Tournament {
        bool exists;
        uint64 finishedAt; // block timestamp at record time
        string winner;     // champion nickname
        PlayerScore[] players;
    }

    // keccak256(tournament UUID) => Tournament
    mapping(bytes32 => Tournament) private tournaments;
    bytes32[] private ids;

    event TournamentRecorded(bytes32 indexed id, string winner, uint256 playerCount);

    modifier onlyOwner() {
        require(msg.sender == owner, "TournamentScores: not owner");
        _;
    }

    /// @notice Sets the deploying account as the contract owner.
    constructor() {
        owner = msg.sender;
    }

    /// @notice Record a finished tournament. Can be called only once per id.
    /// @param id keccak256 of the off-chain tournament UUID
    /// @param winner champion nickname
    /// @param nicknames player nicknames, ordered by final ranking
    /// @param scores per-player score, same order as nicknames
    /// @param ranks per-player rank (1-based), same order as nicknames
    function recordTournament(
        bytes32 id,
        string calldata winner,
        string[] calldata nicknames,
        uint256[] calldata scores,
        uint8[] calldata ranks
    ) external onlyOwner {
        require(!tournaments[id].exists, "TournamentScores: already recorded");
        require(
            nicknames.length == scores.length && scores.length == ranks.length,
            "TournamentScores: length mismatch"
        );
        require(nicknames.length > 0, "TournamentScores: empty");

        Tournament storage t = tournaments[id];
        t.exists = true;
        t.finishedAt = uint64(block.timestamp);
        t.winner = winner;
        for (uint256 i = 0; i < nicknames.length; i++) {
            t.players.push(PlayerScore(nicknames[i], scores[i], ranks[i]));
        }
        ids.push(id);

        emit TournamentRecorded(id, winner, nicknames.length);
    }

    /// @notice Retrieve a recorded tournament. Reverts if unknown.
    function getTournament(bytes32 id)
        external
        view
        returns (uint64 finishedAt, string memory winner, PlayerScore[] memory players)
    {
        require(tournaments[id].exists, "TournamentScores: not found");
        Tournament storage t = tournaments[id];
        return (t.finishedAt, t.winner, t.players);
    }

    /// @notice Whether a tournament id has already been recorded.
    function isRecorded(bytes32 id) external view returns (bool) {
        return tournaments[id].exists;
    }

    /// @notice Total number of recorded tournaments.
    function tournamentCount() external view returns (uint256) {
        return ids.length;
    }
}
