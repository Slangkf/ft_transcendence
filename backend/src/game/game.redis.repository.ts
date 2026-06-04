// src/game/game.redis.repository.ts
import { Redis, RedisKeys } from '../lib/redis';
import { GameState } from './game.types';

/**
 * RedisGameRepository
 * 负责高频、临时的内存游戏状态数据读写。
 * 🌟 注意：Redis 驱动没有 .create() 和 .delete() 方法，
 * 写入/修改必须使用 .set()，删除必须使用 .del()。
 */
export class RedisGameRepository {
    
    /**
     * 统一生成 Redis 中的游戏状态 Key 字符串
     */
    private key(gameId: string): string {
        return RedisKeys.game.state(gameId);
    }

    /**
     * 创建（或覆盖）游戏状态
     * 🌟 修复：将原本不存在的 Redis.create 改为标准的 Redis.set
     */
    public async create(game: GameState): Promise<void> {
        await Redis.set(
            this.key(game.gameId),
            JSON.stringify(game),
            { EX: 3600 } // 1小时强行过期的内存垃圾回收保护垫
        );
    }

    /**
     * 读取分布式缓存中的完整游戏快照
     */
    public async findById(gameId: string): Promise<GameState | null> {
        // 标准的 Redis GET 命令
        const data = await Redis.get(this.key(gameId));
        return data ? JSON.parse(data) : null;
    }

    /**
     * 覆盖更新游戏状态
     */
    public async update(game: GameState): Promise<void> {
        await Redis.set(
            this.key(game.gameId),
            JSON.stringify(game),
            { EX: 3600 }
        );
    }

    /**
     * 销毁缓存生命周期
     * 🌟 修复：将原本不存在的 Redis.delete 改为标准的 Redis.del
     */
    public async delete(gameId: string): Promise<void> {
        await Redis.del(this.key(gameId));
    }

    /**
     * 方案 3 的原子 Lua 答题脚本（保持不变）
     */
    public async submitanswerAtomic(
        gameId: string, 
        userId: string, 
        selectedAnswerIndex: number,
        aiPayload?: { aiId: string; questionId: string; selectedAnswerIndex: number; visibleAt: number } | null
    ) {
        const script = `
            local data = redis.call('get', KEYS[1])
            if not data then return cjson.encode({ error = "STATE_NOT_FOUND" }) end

            local state = cjson.decode(data)
            local userId = ARGV[1]
            local selectIndex = tonumber(ARGV[2])
            local now = tonumber(ARGV[3])
            
            local hasAiPayload = ARGV[4] ~= 'nil'
            local aiPayload = hasAiPayload and cjson.decode(ARGV[4]) or nil

            if state.isFinished then 
                return cjson.encode({ error = "GAME_FINISHED", state = state }) 
            end 

            local currentQuestion = state.questions[state.currentQuestionIndex + 1]
            if not currentQuestion then return cjson.encode({ error = "NO_QUESTION", state = state }) end

            local dedupKey = KEYS[1] .. ":q:" .. currentQuestion.id .. ":u:" .. userId
            if redis.call("GET", dedupKey) == "1" then 
                return cjson.encode({ error = "ALREADY_ANSWERED", state = state })
            end
            redis.call("SET", dedupKey, "1", "EX", 3600)

            local p = state.players[userId]
            if p then
                local isCorrect = (selectIndex == currentQuestion.correctAnswerIndex)
                table.insert(p.answers, {
                    questionId = currentQuestion.id,
                    selectedAnswerIndex = selectIndex,
                    isCorrect = isCorrect,
                    answeredAt = now
                })
                p.status = 'answered'
                if isCorrect then p.score = p.score + 1 end
                state.players[userId] = p
            end

            if aiPayload then
                local aiId = aiPayload.aiId
                local aiPlayer = state.players[aiId]
                if aiPlayer then
                    local aiCorrect = (tonumber(aiPayload.selectedAnswerIndex) == currentQuestion.correctAnswerIndex)
                    
                    table.insert(aiPlayer.answers, {
                        questionId = currentQuestion.id,
                        selectedAnswerIndex = tonumber(aiPayload.selectedAnswerIndex),
                        isCorrect = aiCorrect,
                        answeredAt = now
                    })
                    aiPlayer.score = aiCorrect and (aiPlayer.score + 1) or aiPlayer.score
                    aiPlayer.status = 'answered'
                    state.players[aiId] = aiPlayer
                    
                    state.aiAnswerVisibleAt = tonumber(aiPayload.visibleAt)
                    state.aiCachedAnswer = {
                        userId = aiId,
                        questionId = currentQuestion.id,
                        isCorrect = aiCorrect,
                        selectedAnswerIndex = tonumber(aiPayload.selectedAnswerIndex)
                    }
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
                String(userId), 
                String(selectedAnswerIndex), 
                String(Date.now()),
                aiPayload ? JSON.stringify(aiPayload) : 'nil'
            ],
        });
        return result ? JSON.parse(result as string) : null;
    }
}