import type { NextApiRequest, NextApiResponse } from 'next'
import { deductCredits } from '@/lib/customerService'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, type } = req.body

  if (!email || !type) {
    return res.status(400).json({ error: 'Email and type are required' })
  }

  if (type !== 'chat' && type !== 'doc') {
    return res.status(400).json({ error: 'Invalid credit type' })
  }

  try {
    const success = await deductCredits(email, type)

    if (!success) {
      return res.status(400).json({ error: 'Insufficient credits' })
    }

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error deducting credits:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
