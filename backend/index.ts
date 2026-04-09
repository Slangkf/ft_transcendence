import {express} from 'express';
import {Request, Response } from 'express'
import {audRouter} from 'src/authendification/aud.router.js'; 

const app = express();
const PORT = 3000;

app.use(express.json());
app.use('', audRouter);

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});