// src/game/game.redis.repository.ts
import { Redis, RedisKeys } from '../lib/redis';
import { GameState } from './game.types';

/*
 * RedisGameRepository
 * Handles the high-frequency, transient in-memory game state stored in Redis.
 * Note: the Redis driver has no .create()/.delete() — use .set() to write and
 * .del() to remove.
 */
export class RedisGameRepository {

    /* Builds the Redis key string for a game's state. */
    private key(gameId: string): string {
        return RedisKeys.game.state(gameId);
    }

    /* Creates (or overwrites) the game state in Redis with a 1h TTL. */
    public async create(game: GameState): Promise<void> {
        await Redis.set(
            this.key(game.gameId),
            JSON.stringify(game),
            { EX: 3600 } // 1h hard expiry as an in-memory garbage-collection safety net
        );
    }

    /* Reads the full game state snapshot from Redis, or null if absent. */
    public async findById(gameId: string): Promise<GameState | null> {
        // standard Redis GET command
        const data = await Redis.get(this.key(gameId));
        return data ? JSON.parse(data) : null;
    }

    /* Overwrites the stored game state (refreshing the 1h TTL). */
    public async update(game: GameState): Promise<void> {
        await Redis.set(
            this.key(game.gameId),
            JSON.stringify(game),
            { EX: 3600 }
        );
    }

    /* Deletes the game state from Redis. */
    public async delete(gameId: string): Promise<void> {
        await Redis.del(this.key(gameId));
    }

    /*
     * Atomic Lua answer script (Strategy 3): human and AI submissions are
     * handled uniformly as "tasks" inside one atomic Redis transaction.
     */
    public async submitanswerAtomic(
        gameId: string,
        tasks: Array<{ id: string; ans: number; questionId: number; visibleAt?: number }>,
        now: number
    ) {
        const script = `
            local data = redis.call('get', KEYS[1])
            if not data then return cjson.encode({ error = "STATE_NOT_FOUND" }) end

            local state = cjson.decode(data)
            local tasks = cjson.decode(ARGV[1])
            local now = tonumber(ARGV[2])

            if state.isFinished then 
                return cjson.encode({ error = "GAME_FINISHED", state = state }) 
            end 

            local currentQuestion = state.questions[state.currentQuestionIndex + 1]
            if not currentQuestion then return cjson.encode({ error = "NO_QUESTION", state = state }) end
            local correct = tonumber(currentQuestion.correctAnswerIndex)
            local qStart = tonumber(state.questionStartedAt) or now
            local elapsed = now - qStart
            if elapsed < 0 then elapsed = 0 end

            for _, task in ipairs(tasks) do
                local taskId = tostring(task.id)
                if string.sub(taskId, 1, 3) ~= "ai_" then
                    local dedupKey = KEYS[1] .. ":q:" .. currentQuestion.id .. ":u:" .. taskId
                    if redis.call("GET", dedupKey) == "1" then
                        return cjson.encode({ error = "ALREADY_ANSWERED", state = state })
                    end
                    redis.call("SET", dedupKey, "1", "EX", 3600)
                end
            end

            for _, task in ipairs(tasks) do
                local taskId = tostring(task.id)
                local p = state.players[taskId]
                if p and tonumber(task.questionId) == tonumber(currentQuestion.id) then
                    if type(p.answers) ~= "table" then
                        p.answers = {}
                    end

                    local ans = tonumber(task.ans)
                    local isCorrect = (ans == correct)
                    table.insert(p.answers, {
                        questionId = currentQuestion.id,
                        selectedAnswerIndex = ans,
                        isCorrect = isCorrect,
                        answeredAt = now
                    })
                    p.status = 'answered'
                    p.Totaltime = (tonumber(p.Totaltime) or 0) + elapsed
                    if isCorrect then p.score = (p.score or 0) + 1 end
                    state.players[taskId] = p
                    
                    if string.sub(taskId, 1, 3) == "ai_" then
                        state.aiAnswerVisibleAt = tonumber(task.visibleAt) or now
                        state.aiCachedAnswer = {
                            userId = taskId,
                            questionId = currentQuestion.id,
                            isCorrect = isCorrect,
                            selectedAnswerIndex = ans
                        }
                    end
                end
            end

            local allAnswered = true
            for pid, player in pairs(state.players) do
                if player.status ~= 'disconnected' and player.status ~= 'answered' then
                    allAnswered = false
                    break
                end
            end

            if allAnswered then
                if state.currentQuestionIndex + 1 >= #state.questions then
                    state.isFinished = true
                    state.status = 'finished'
                else
                    state.currentQuestionIndex = state.currentQuestionIndex + 1
                    state.questionStartedAt = now
                    for pid, player in pairs(state.players) do
                        if player.status ~= 'disconnected' then
                            player.status = 'playing'
                        end 
                        state.players[pid] = player
                    end
                end
            end

            redis.call('SET', KEYS[1], cjson.encode(state), 'EX', 3600)
            return cjson.encode({ state = state, success = true })
        `;

        const key = this.key(gameId);
        const result = await Redis.eval(script, {
            keys: [key],
            arguments: [
                JSON.stringify(tasks),
                String(now)
            ],
        });
        return result ? JSON.parse(result as string) : null;
    }

    /**
     * Forcibly close the current question for any player who has not answered yet,
     * recording a wrong answer (selectedAnswerIndex = -1) and then advancing the game.
     * Only fires if the game is still on `expectedQIndex` (no-op otherwise — protects
     * against a race where the question advanced naturally just before the timer fired).
     * Returns the new state, or null if no-op.
     */
    public async forceAdvanceOnTimeout(gameId: string, expectedQIndex: number): Promise<GameState | null> {
        const script = `
            local data = redis.call('get', KEYS[1])
            if not data then return nil end

            local state = cjson.decode(data)
            local now = tonumber(ARGV[1])
            local expected = tonumber(ARGV[2])

            if state.isFinished then return nil end
            if tonumber(state.currentQuestionIndex) ~= expected then return nil end

            local currentQuestion = state.questions[state.currentQuestionIndex + 1]
            if not currentQuestion then return nil end

            local qStart = tonumber(state.questionStartedAt) or now
            local elapsed = now - qStart
            if elapsed < 0 then elapsed = 0 end

            local timedOutAny = false
            for pid, p in pairs(state.players) do
                if p.status ~= 'disconnected' and p.status ~= 'answered' then
                    if type(p.answers) ~= 'table' then p.answers = {} end
                    local newAnswer = {
                        questionId = currentQuestion.id,
                        selectedAnswerIndex = -1,
                        isCorrect = false,
                        answeredAt = now
                    }
                    table.insert(p.answers, newAnswer)
                    p.status = 'answered'
                    p.Totaltime = (tonumber(p.Totaltime) or 0) + elapsed
                    state.players[pid] = p
                    timedOutAny = true
                end
            end

            if not timedOutAny then return nil end

            -- advance (everyone is now answered)
            if state.currentQuestionIndex + 1 >= #state.questions then
                state.isFinished = true
                state.status = 'finished'
            else
                state.currentQuestionIndex = state.currentQuestionIndex + 1
                state.questionStartedAt = now
                for pid, p in pairs(state.players) do
                    if p.status ~= 'disconnected' then
                        p.status = 'playing'
                    end
                    state.players[pid] = p
                end
            end

            local ttl = redis.call('TTL', KEYS[1])
            if ttl <= 0 then ttl = 3600 end
            redis.call('SET', KEYS[1], cjson.encode(state), 'EX', ttl)

            return cjson.encode(state)
        `;
        const key = RedisKeys.game.state(gameId);
        const result = await Redis.eval(script, {
            keys: [key],
            arguments: [String(Date.now()), String(expectedQIndex)],
        });
        return result ? JSON.parse(result as string) : null;
    }
}
