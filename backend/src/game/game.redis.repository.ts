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
    tasks: Array<{ id: string; ans: number }>,
    now: number
    ) {
        const script = `
            local data = redis.call('get', KEYS[1])
if not data then
    return cjson.encode({ error = "STATE_NOT_FOUND" })
end

local state = cjson.decode(data)
local tasks = cjson.decode(ARGV[1])
local now = tonumber(ARGV[2])

-- 游戏结束保护
if state.isFinished then
    return cjson.encode({ error = "GAME_FINISHED", state = state })
end

-- 当前题目
local currentQuestion = state.questions[state.currentQuestionIndex + 1]
if not currentQuestion then
    return cjson.encode({ error = "NO_QUESTION", state = state })
end

local correct = tonumber(currentQuestion.correctAnswer)

----------------------------------------------------
-- 1. 防重复提交（只对 human 做 dedup）
----------------------------------------------------
for _, task in ipairs(tasks) do
    if string.sub(task.id, 1, 3) ~= "ai_" then
        local dedupKey = KEYS[1] .. ":q:" .. currentQuestion.id .. ":u:" .. task.id

        if redis.call("GET", dedupKey) == "1" then
            return cjson.encode({
                error = "ALREADY_ANSWERED",
                state = state
            })
        end

        redis.call("SET", dedupKey, "1", "EX", 3600)
    end
end

----------------------------------------------------
-- 2. 执行 tasks（human + AI 统一处理）
----------------------------------------------------
for _, task in ipairs(tasks) do
    local p = state.players[task.id]

    if p then

        -- ⚠️ 防 answers 被污染（关键修复）
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

        p.status = "answered"

        if isCorrect then
            p.score = (p.score or 0) + 1
        end

        state.players[task.id] = p
    end
end

----------------------------------------------------
-- 3. 检查是否全部回答
----------------------------------------------------
local allAnswered = true

for _, player in pairs(state.players) do
    if player.status ~= "answered" and player.status ~= "disconnected" then
        allAnswered = false
        break
    end
end

----------------------------------------------------
-- 4. 切题 or 结束
----------------------------------------------------
if allAnswered then
    if state.currentQuestionIndex + 1 >= #state.questions then
        state.isFinished = true
        state.status = "finished"
    else
        state.currentQuestionIndex = state.currentQuestionIndex + 1
        state.questionStartedAt = now

        for _, player in pairs(state.players) do
            if player.status ~= "disconnected" then
                player.status = "playing"
            end
        end
    end
end

----------------------------------------------------
-- 5. 写回 Redis
----------------------------------------------------
redis.call('SET', KEYS[1], cjson.encode(state), 'EX', 3600)

return cjson.encode({
    success = true,
    state = state
})
        `;

        const key = this.key(gameId);
        const result = await Redis.eval(script, {
        keys: [key],
        arguments: [
            JSON.stringify(tasks),
            String(now),
        ],
    });

    return result ? JSON.parse(result as string) : null;
}
}