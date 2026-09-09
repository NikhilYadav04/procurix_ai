import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { getTmpDir } from '@/lib/tmpDir';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { path: filePath } = req.query;

  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ error: 'File path is required' });
  }

  try {
    console.log('[DOWNLOAD] Requested file path:', filePath);
    
    let fullPath: string;
    const tmpDir = getTmpDir();
    
    // Handle multiple path formats (cross-platform)
    if (filePath.startsWith('/tmp/') || filePath.startsWith(tmpDir)) {
      // Already an absolute tmp path
      fullPath = filePath;
    } else if (filePath.startsWith('tmp/') || filePath.startsWith('tmp\\')) {
      // Relative tmp path
      fullPath = path.join(tmpDir, filePath.replace(/^tmp[\\/]/, ''));
    } else if (filePath.startsWith('rfps/') || filePath.startsWith('reports/')) {
      // New relative format: rfps/filename or reports/filename
      fullPath = path.join(tmpDir, filePath);
    } else {
      // Legacy relative path from project root (for backward compatibility)
      fullPath = path.resolve(process.cwd(), filePath);
    }

    console.log('[DOWNLOAD] Resolved full path:', fullPath);
    console.log('[DOWNLOAD] File exists:', fs.existsSync(fullPath));

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.error('[DOWNLOAD] File not found at:', fullPath);
      return res.status(404).json({ error: 'File not found', path: fullPath, tmpDir, requestedPath: filePath });
    }

    // Read the file
    const fileBuffer = fs.readFileSync(fullPath);
    const fileName = path.basename(fullPath);

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', fileBuffer.length);

    // Send the file
    res.send(fileBuffer);
  } catch (error) {
    console.error('Error downloading RFP:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
}
