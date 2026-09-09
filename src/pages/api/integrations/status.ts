import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID required' });
    }

    // Check Gmail integration status
    const { data: gmailIntegration } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('integration_type', 'gmail')
      .eq('is_active', true)
      .single();

    res.status(200).json({
      gmail: {
        connected: !!gmailIntegration,
        connectedAt: gmailIntegration?.connected_at || null,
      },
    });
  } catch (error: any) {
    console.error('Error checking integration status:', error);
    res.status(500).json({ message: error.message || 'Failed to check status' });
  }
}
