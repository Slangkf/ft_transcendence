import {z} from "zod"

//type question from database
export const Question_DB = z.object({
    id: z.string().uuid(),
    text: z.string(),
    options: z.string(),
    answer: z.string()
})
export type QuestionDB = z.infer<typeof Question_DB>

//type question for front, question without answer
export const Question_Without_Answer = z.object({
    id: z.string().uuid(),
    text: z.string(),
    options: z.string()
})
export type QuestionWithoutAnswer = z.infer<typeof Question_Without_Answer>

