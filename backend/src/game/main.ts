import express from 'express';
import gameRouter from './game.router';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use('/game', gameRouter);

app.listen(PORT, () =>
{
    console.log(`Server running on http://localhost:${PORT}`);
});
