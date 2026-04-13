import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import {Request, Response } from 'express'
import {AuthRouter} from './auth/auth.router'; 
import {UserRouter} from './User/user.router';
import cookieParser from 'cookie-parser';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', AuthRouter);
app.use('/api/user', UserRouter);

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});