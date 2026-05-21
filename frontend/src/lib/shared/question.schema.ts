import {z} from "zod"

// Backend: Database schema for Question
export const QuestionSchema = z.object({
    id: z.number(),
    question: z.string(),
    options: z.array(z.string()),
    correctAnswerIndex: z.number()
})
export type Question = z.infer<typeof QuestionSchema>

// Frontend: Public question schema (without correct answer)
export const PublicQuestionSchema = z.object({
    id: z.number(),
    question: z.string(),
    options: z.array(z.string())
})
export type PublicQuestion = z.infer<typeof PublicQuestionSchema>

