import { GameInfo, GameState, IModeService, PublicGameState, StartGameResult,
    Player,PublicPlayer} from "../game.types"
import { GameBaseService } from '../game.base';
import { AppError, ErrorCode } from 'src/error/apperror';

export class SoloService extends GameBaseService implements IModeService
{
    async startGame(userId: string): Promise<StartGameResult | null>
    {
        const players = { [userId]: this.buildPlayer(userId) };

        const state = await this.prepareGame(players, "solo");
        await this.gameRepository.create(state);
        return {gameId: state.gameId,
            question: this.questionService.toPublicQuestion(state.questions[0]),
        }
    } 

    public async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): Promise<GameInfo | null>
    {
        const gameState = await this.gameRepository.findById(gameId);

        if (!gameState)
            throw new AppError(
                'Gamestate not find',
                ErrorCode.GAME_NOT_FOUND,
                404);

        if (gameState.isFinished)
        {
            return {
                gameresult: this.toPublicState(gameState),
                correctAnswer: '',
                nextQuestion: null,
            };
        }
        const player = gameState.players[userId];
        if (!player) throw new AppError(
            'player not find',
            ErrorCode.PLAYER_NOT_FOUND);
        if (player.status === 'answered') throw new AppError(
            'already answered',
            ErrorCode.PLAYER_ALREADY_ANSWERED
        )
        this.validateAnswer(gameState, selectedAnswerIndex, userId);
        this.advance(gameState);

        await this.gameRepository.update(gameState);
        if (gameState.isFinished){
            await this.gameRepository.delete(gameState.gameId);
            return this.buildfinishedGameInfo(gameState);
        }

        return this.buildPlayingGameInfo(gameState);
    }
}
