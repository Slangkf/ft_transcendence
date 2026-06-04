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
   // game.redis.repository.ts
public async submitanswerAtomic(
  gameId: string, 
  userId: string, 
  selectedAnswerIndex: number,
  isAIGame: boolean = false  // ← 新增参数
) {
    const script = `
        local data = redis.call('get', KEYS[1])
        if not data then return nil end

        local state = cjson.decode(data)
        local userId = ARGV[1]
        local selectIndex = tonumber(ARGV[2])
        local isAIGame = ARGV[4] == 'true'

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
        if answered then 
            return cjson.encode({
                error = "ALREADY_ANSWERED",
                userId = userId,
                questionId = currentQuestion.id
            })
        end

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

        -- 判断是否推进题目
        local allAnswered = true
        if isAIGame then
            -- AI模式：只要人类答完就推进
            for pid, p in pairs(state.players) do
                if not p.isAI and p.status ~= 'disconnected' and p.status ~= 'answered' then
                    allAnswered = false
                    break
                end
            end
        else
            -- 多人模式：所有人都答完才推进
            for pid, p in pairs(state.players) do
                if p.status ~= 'disconnected' and p.status ~= 'answered' then
                    allAnswered = false
                    break
                end
            end
        end

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
            String(Date.now()),
            isAIGame ? 'true' : 'false'  // ← ARGV[4]
        ],
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