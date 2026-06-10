import type { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

const avatarDirectory = path.resolve(process.cwd(), 'avatars');

fs.mkdirSync(avatarDirectory, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, avatarDirectory);
    },
    filename: (_req, file, cb) => {
        const extension = path.extname(file.originalname) || '.jpg';
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension.toLowerCase()}`;
        cb(null, uniqueName);
    }
});

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const avatarUpload = multer({
    storage,
    limits: {
        fileSize: 2 * 1024 * 1024
    },
    fileFilter: (_req, file, cb) => {
        if (!allowedMimeTypes.has(file.mimetype)) {
            return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
        }
        cb(null, true);
    }
});

/*
 * Middleware accepting a single 'avatar' file upload.
 * Replies 400 on a multer validation error (too big / wrong type),
 * 500 on any other error, and calls next() on success.
 */
export const handleAvatarUpload = (req: Request, res: Response, next: NextFunction) => {
    avatarUpload.single('avatar')(req, res, (error) => {
        if (error instanceof multer.MulterError) {
            const message = error.code === 'LIMIT_FILE_SIZE'
                ? 'avatar must be 2MB or smaller'
                : 'avatar must be a jpg, png or webp image';
            return res.status(400).json({ message });
        }

        if (error) {
            return res.status(500).json({ message: 'Internal avatar upload error' });
        }

        next();
    });
};
