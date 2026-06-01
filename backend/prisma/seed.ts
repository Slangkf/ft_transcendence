/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   seed.ts                                            :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: jmen <jmen@student.42.fr>                  +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/04/02 18:30:48 by ikayiban          #+#    #+#             */
/*   Updated: 2026/06/01 12:43:00 by jmen             ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const prisma: PrismaClient = new PrismaClient();
//const __filename: string = fileURLToPath(import.meta.url);
//const __dirname: string = path.dirname(__filename);

interface Question
{
    text:       string;
    options:    string[];
    answer:     string;
}

interface Quiz
{
    title:      string;
    category:   string;
    questions:  Question[];
}

async function connectWithRetry(retries = 5) {
  while (retries > 0) {
    try {
      await prisma.$connect();
      const result = await prisma.$queryRaw`SELECT current_user, current_database();`;
      return;
    } catch (err) {
      console.log(`Failed to connecte database, retries reste: ${retries--}`);
      await new Promise(res => setTimeout(res, 2000));
    }
  }
  throw new Error('Cannot to connecte Prisma');
}


async function main(): Promise<void> {
    await connectWithRetry();
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
        throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables');
    }

    const hashed_password = await bcrypt.hash(adminPassword, 10);
    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
            email: adminEmail,
            username: "admin",
            password: hashed_password,
            role: "ADMIN",
            score: 0
        }
    });

    const folders: string[] = [
        "culture_generale",
        "divertissement",
        "histoire_geo",
        "sciences"
    ];

    for (const folder of folders) {
        const folderPath: string = path.join(__dirname, "data", folder);

        if (!fs.existsSync(folderPath)) {
            console.warn(`Dossier non trouvé : ${folderPath}`);
            continue;
        }

        const files: string[] = fs.readdirSync(folderPath).filter(f => f.endsWith('.json'));

        for (const file of files) {
            const filePath: string = path.join(folderPath, file);
            const content: Quiz = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Quiz;

            await prisma.quiz.create({
                data: {
                    title: content.title,
                    category: content.category,
                    authorId: admin.id,
                    questions: {
                        create: content.questions.map((q: Question) => ({
                            text: q.text,
                            options: q.options,
                            answer: q.answer
                        }))
                    }
                }
            });
            // console.log(`good : ${folder}/${file}`);
        }
    }

    // fail loudly instead of leaving an empty database: a multiplayer/solo game can never
    // start (the lobby stays stuck) if there is no quiz to draw questions from.
    const quizCount: number = await prisma.quiz.count();
    if (quizCount === 0) {
        throw new Error('Seed produced no quizzes — check that prisma/data/<category>/*.json files exist. The game cannot start without questions.');
    }
}
main()
  .catch((e: Error) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });