/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   seed.ts                                            :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: ikayiban <ikayiban@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/04/02 18:30:48 by ikayiban          #+#    #+#             */
/*   Updated: 2026/04/08 13:20:50 by ikayiban         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const prisma: PrismaClient = new PrismaClient();
const __filename: String = fileURLToPath(import.meta.url);
const __dirname: String = path.dirname(__filename);

interface Question
{
    text:       String;
    options:    String[];
    answer:     String;
}

interface Quiz
{
    title:      String;
    category:   String;
    questions:  Question[];
}

async function main(): Promise<void> {
    const admin = await prisma.user.upsert({
        where: { email: "seedAdmin@42paris.fr" },
        update: {},
        create: {
            email: "seedAdmin@42paris.fr",
            username: "admin",
            role: "ADMIN",
            score: 0
        }
    });
    
    const dataDir: string = path.join(__dirname, "data");
    
    if (!fs.existsSync(dataDir))
    {
        console.error("directory not found!");
        return ;
    }

    const files: string[] = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));

    for (const file of files)
    {
        const filePath: string = path.join(dataDir, file);
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
