import express, { Request, Response } from 'express';
import questionroute from './question/questionRouter.js'; 

const app = express();
const PORT = 3000;

app.use(express.json());
app.use('/api/questions', questionroute);

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});