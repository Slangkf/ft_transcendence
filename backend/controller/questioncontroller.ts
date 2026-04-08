import { Request, Response } from 'express';

export const getAllquestions = (req: Request, res: Response) => {
    res.json({ message: "Liste des questions (Mock)" });
};

export const getQuestionbyId = (req: Request, res: Response) => {
    res.json({ message: "Détail de la question (Mock)" });
};

export const submitAnswer = (req: Request, res: Response) => {
    res.json({ message: "Réponse soumise (Mock)" });
};