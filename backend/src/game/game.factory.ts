import { QuestionRepository } from "src/question/question.repository";
import { SoloService } from "./solo/solo"
import {RedisGameRepository} from "./game.redis.repository"
import { QuestionService } from "src/question/question.service";
import { IModeService } from "./game.types";

const repo = new RedisGameRepository();
const questionService = new QuestionService(new QuestionRepository());
type Mode = "solo";

export class GameServiceFactory{
    private static services: Record<Mode, IModeService> = {
        solo : new SoloService(repo, questionService),
    };

    static get(mode: string){
        return this.services[mode as Mode] ?? null; 
    }
}