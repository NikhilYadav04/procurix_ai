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

    console.log('[CHECK GMAIL] Checking for userId:', userId);

    // Get all integrations for this user
    const { data: allIntegrations, error: allError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId);

    console.log('[CHECK GMAIL] All integrations:', allIntegrations);
    console.log('[CHECK GMAIL] Query error:', allError);

    // Get Gmail specifically
    const { data: gmailIntegration, error: gmailError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('integration_type', 'gmail')
      .eq('is_active', true)
      .maybeSingle();

    console.log('[CHECK GMAIL] Gmail integration:', gmailIntegration);
    console.log('[CHECK GMAIL] Gmail error:', gmailError);

    res.status(200).json({
      userId,
      allIntegrations: allIntegrations || [],
      gmailIntegration: gmailIntegration || null,
      found: !!gmailIntegration,
      errors: {
        all: allError?.message || null,
        gmail: gmailError?.message || null,
      }
    });
  } catch (error: any) {
    console.error('[CHECK GMAIL] Error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to check Gmail integration',
      stack: error.stack 
    });
  }
}
