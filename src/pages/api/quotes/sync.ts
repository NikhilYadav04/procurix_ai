import type { NextApiRequest, NextApiResponse } from 'next';
import { syncQuotes } from '@/lib/quoteSync';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { userId, customerEmail, days, maxMessages } = req.body as {
    userId?: string;
    customerEmail?: string;
    days?: number;
    maxMessages?: number;
  };

  if (!userId || !customerEmail) {
    return res.status(400).json({ success: false, error: 'userId and customerEmail are required' });
  }

  try {
    const result = await syncQuotes(userId, customerEmail, { days, maxMessages });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    console.error('[QUOTES SYNC API] Failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
