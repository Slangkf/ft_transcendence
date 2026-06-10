import { expect } from "chai";
import { ethers } from "hardhat";

/* Hashes an off-chain tournament UUID into the bytes32 id used on-chain. */
const id = (uuid: string) => ethers.keccak256(ethers.toUtf8Bytes(uuid));

describe("TournamentScores", () => {
  /* Deploys a fresh TournamentScores contract and returns it with two signers. */
  async function deploy() {
    const [owner, other] = await ethers.getSigners();
    const c = await (await ethers.getContractFactory("TournamentScores")).deploy();
    await c.waitForDeployment();
    return { c, owner, other };
  }

  it("records and retrieves a tournament", async () => {
    const { c } = await deploy();
    const tid = id("uuid-1");

    await c.recordTournament(tid, "alice", ["alice", "bob"], [10, 7], [1, 2]);

    const [, winner, players] = await c.getTournament(tid);
    expect(winner).to.equal("alice");
    expect(players.length).to.equal(2);
    expect(players[0].nickname).to.equal("alice");
    expect(players[0].score).to.equal(10n);
    expect(players[0].rank).to.equal(1);
    expect(await c.tournamentCount()).to.equal(1n);
  });

  it("is immutable: a tournament id can be recorded only once", async () => {
    const { c } = await deploy();
    const tid = id("uuid-1");

    await c.recordTournament(tid, "alice", ["alice"], [10], [1]);
    await expect(
      c.recordTournament(tid, "bob", ["bob"], [99], [1])
    ).to.be.revertedWith("TournamentScores: already recorded");
  });

  it("rejects writes from non-owner accounts", async () => {
    const { c, other } = await deploy();
    const tid = id("uuid-2");

    await expect(
      c.connect(other).recordTournament(tid, "x", ["x"], [1], [1])
    ).to.be.revertedWith("TournamentScores: not owner");
  });

  it("reverts when reading an unknown tournament", async () => {
    const { c } = await deploy();
    await expect(c.getTournament(id("nope"))).to.be.revertedWith(
      "TournamentScores: not found"
    );
  });
});
