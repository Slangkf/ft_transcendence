import { Redis, RedisKeys } from '../lib/redis';
import { GameState } from './game.types';


export class RedisGameRepository 
{
    private key(gameId: string) {
        return RedisKeys.game.state(gameId);
    }
   public async create(game: GameState): Promise<void>{
    await Redis.set(
        this.key(game.gameId),
        JSON.stringify(game),
        {EX: 3600})
   }

   public async findById(gameId: string): Promise<GameState | null>{
    const data = await Redis.get(this.key(gameId));
    return data ? JSON.parse(data) : null
   }

   public async update(game: GameState): Promise<void>{
    await Redis.set(
        this.key(game.gameId),
        JSON.stringify(game),
        {EX: 3600}
    )
   }

   public async delete(gameId: string): Promise<void>{
    await Redis.del(this.key(gameId))
   }

   //lua script for datarace in sumbit answer with multiplayer
   public async submitanswerAtomic(gameId: string, userId: string, selectedAnswerIndex: number)
   {
    //script to finish all submit answer at one time 
    //1. check if the game finishe 
    //2. check if the question is already answer, check if is correct for the score, not yeat update the player with the new answer 
    //3. check every player answered the question, advance the game
    //4. add in redis the ttl 
    const script = `
        local data = redis.call('get', KEYS[1])
        if not data then return nil end

        local state = cjson.decode(data)
        local userId = ARGV[1]
        local selectIndex = tonumber(ARGV[2])

        if state.isFinished then return nil end 

        local player = state.players[userId]
        if not player then return nil end 

        local currentQuestion = state.questions[state.currentQuestionIndex + 1]
        local answered = false
        if type(player.answers) == 'table' then
            for _, answer in pairs(player.answers) do
                if answer.questionId == currentQuestion.id then
                    answered = true
                    break
                end
            end
        end
        if answered then return nil end

        local isCorrect = (selectIndex == currentQuestion.correctAnswerIndex)
        local now = tonumber(ARGV[3])
        local qStart = tonumber(state.questionStartedAt) or now
        local elapsed = now - qStart
        if elapsed < 0 then elapsed = 0 end

        local newAnswer = {
            questionId = currentQuestion.id,
            selectedAnswerIndex = selectIndex,
            isCorrect = isCorrect,
            answeredAt = now
        }
        table.insert(player.answers, newAnswer)
        player.status = 'answered'
        player.Totaltime = (tonumber(player.Totaltime) or 0) + elapsed
        if isCorrect then
            player.score = player.score + 1
        end
        state.players[userId] = player

        --check if all players answered

        local allAnswered = true
        for pid, p in pairs(state.players) do
            if p.status ~= 'disconnected' and p.status ~= 'answered' then
                allAnswered = false
                break
            end
        end
    
        --advance the game
        if allAnswered then
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
        end

        local ttl = redis.call('TTL', KEYS[1])
        if ttl <= 0 then ttl = 3600 end
        redis.call('SET', KEYS[1], cjson.encode(state), 'EX', ttl)
        
        return cjson.encode(state)
        `;    
    const key = RedisKeys.game.state(gameId);
    const result = await Redis.eval(script, {
    keys: [key],
    arguments: [
        String(userId),
        String(selectedAnswerIndex),
        String(Date.now())
        ],
    })
    return result ? JSON.parse(result as string) : null
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

// redis version: 
/***
 * 1. save the gamestate in json version in redis 
 * 2. when lost connection can come back with redis 
 * 3. redis can save the information for only 1h 
 * 4. when all information saved in database, delete in redis 
 * 
 */