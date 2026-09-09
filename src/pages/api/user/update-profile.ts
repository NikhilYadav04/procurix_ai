import type { NextApiRequest, NextApiResponse } from 'next'
import { updateUser, getUserByEmail } from '../../../lib/userService'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Handle GET request - fetch user profile
  if (req.method === 'GET') {
    try {
      const { email } = req.query

      if (!email || typeof email !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Email is required'
        })
      }

      const user = await getUserByEmail(email)

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        })
      }

      return res.status(200).json({
        success: true,
        data: user
      })
    } catch (error: any) {
      console.error('Error fetching user profile:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      })
    }
  }

  // Handle POST request - update user profile
  if (req.method === 'POST') {
    try {
      const { email, role, industry } = req.body

      if (!email || !role || !industry) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields'
        })
      }

      const user = await updateUser(email, { role, industry })

      if (!user) {
        return res.status(400).json({
          success: false,
          error: 'Failed to update profile'
        })
      }

      return res.status(200).json({
        success: true,
        data: user
      })
    } catch (error: any) {
      console.error('Error updating user profile:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      })
    }
  }

  // Method not allowed
  return res.status(405).json({ 
    success: false, 
    error: 'Method not allowed' 
  })
}
