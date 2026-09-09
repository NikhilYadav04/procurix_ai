import type { NextApiRequest, NextApiResponse } from 'next'
import { getCustomerByEmail, getOrCreateCustomer } from '@/lib/customerService'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { email } = req.query

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' })
  }

  if (req.method === 'GET') {
    try {
      const customer = await getOrCreateCustomer(email)
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' })
      }

      return res.status(200).json(customer)
    } catch (error) {
      console.error('Error fetching customer:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
