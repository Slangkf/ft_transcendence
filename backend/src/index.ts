import express from 'express';
import {Request, Response } from 'express'
import {AuthRouter} from './auth/auth.router'; 

const app = express();
const PORT = 3000;

app.use(express.json());
app.use('/', AuthRouter);

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});