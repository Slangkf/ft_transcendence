import { QuestionRepository } from "src/question/question.repository";
import { SoloService } from "./solo/solo"
import {LocalGameRepository} from "./solo/solo.localrepository"
import { QuestionService } from "src/question/question.service";

const repo = new LocalGameRepository();
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