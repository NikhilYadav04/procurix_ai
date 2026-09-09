import type { NextApiRequest, NextApiResponse } from 'next';
import { gmailService } from '@/lib/gmailService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { userId, action } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID required' });
    }

    if (action === 'connect') {
      // Generate OAuth URL
      const authUrl = gmailService.getAuthUrl(userId);
      return res.status(200).json({ authUrl });
    }

    if (action === 'disconnect') {
      // Disconnect Gmail integration
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      await supabase
        .from('user_integrations')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('integration_type', 'gmail');

      return res.status(200).json({ success: true, message: 'Gmail disconnected' });
    }

    return res.status(400).json({ message: 'Invalid action' });
  } catch (error: any) {
    console.error('Gmail integration error:', error);
    res.status(500).json({ message: error.message || 'Integration failed' });
  }
}
