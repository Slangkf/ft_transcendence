/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   seed.ts                                            :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: ikayiban <ikayiban@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/04/02 18:30:48 by ikayiban          #+#    #+#             */
/*   Updated: 2026/04/11 14:24:22 by ikayiban         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';

const prisma: PrismaClient = new PrismaClient();
const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = path.dirname(__filename);

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

async function main(): Promise<void> {
    const hashed_password = await bcrypt.hash("admin_pass", 10);
    const admin = await prisma.user.upsert({
        where: { email: "seedAdmin@42paris.fr" },
        update: {},
        create: {
            email: "seedAdmin@42paris.fr",
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
            console.log(`good : ${folder}/${file}`);
        }
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