import express from 'express';
const router = express.Router();
import * as questionController from '../controller/questioncontroller.js';

router.get('/', questionController.getAllquestions);
router.get('/:id', questionController.getQuestionbyId);
router.post('/:id/submit', questionController.submitAnswer);

export default router;