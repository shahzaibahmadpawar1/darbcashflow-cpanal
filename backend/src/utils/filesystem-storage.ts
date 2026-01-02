import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

/**
 * Upload file to filesystem storage
 * @param file - Multer file object
 * @returns Public URL path for the uploaded file
 */
export const uploadToFilesystem = async (file: Express.Multer.File): Promise<string> => {
    try {
        // Get upload directory from environment or use default
        const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'receipts');
        const baseUrl = process.env.BASE_URL || process.env.FRONTEND_URL || '';

        // Ensure upload directory exists
        await mkdir(uploadDir, { recursive: true });

        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(7);
        const fileExtension = file.originalname.split('.').pop();
        const fileName = `receipt-${timestamp}-${randomString}.${fileExtension}`;
        const filePath = path.join(uploadDir, fileName);

        // Write file to disk
        await writeFile(filePath, file.buffer);

        // Return public URL path
        // If BASE_URL is set, return full URL, otherwise return relative path
        const publicPath = baseUrl 
            ? `${baseUrl}/uploads/receipts/${fileName}`
            : `/uploads/receipts/${fileName}`;

        console.log('File uploaded successfully:', filePath);
        return publicPath;
    } catch (error: any) {
        console.error('File upload error:', error);
        throw new Error(`Failed to upload file: ${error.message}`);
    }
};

export default uploadToFilesystem;

