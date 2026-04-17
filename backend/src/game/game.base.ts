import { QuestionService } from "src/question/question.service";
import { IGameRepository } from "./game.repository";

export class GameBaseService 
{
    constructor(
        protected  gameRepository: IGameRepository,
        protected readonly questionService: QuestionService
    ){}
}

/**
 * Game base: prepare questions
 * 
 * 
 * 
 */