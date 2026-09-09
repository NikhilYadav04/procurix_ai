import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Proxy endpoint for user profile pictures to avoid CORS issues
 * This endpoint fetches the Google profile picture and returns it
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email } = req.query

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' })
  }

  try {
    // Get session to find picture URL
    const cookies = req.headers.cookie?.split(';') || []
    const sessionCookie = cookies.find(c => c.trim().startsWith('session='))
    
    if (!sessionCookie) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const sessionValue = sessionCookie.split('=')[1]
    const sessionData = JSON.parse(decodeURIComponent(sessionValue))

    if (sessionData.user?.email !== email) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    if (!sessionData.user?.picture) {
      return res.status(404).json({ error: 'No picture available' })
    }

    // Fetch the image from Google
    const imageResponse = await fetch(sessionData.user.picture)
    
    if (!imageResponse.ok) {
      return res.status(404).json({ error: 'Image not found' })
    }

    const imageBuffer = await imageResponse.arrayBuffer()
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'

    // Set cache headers
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=3600') // Cache for 1 hour
    
    return res.send(Buffer.from(imageBuffer))
  } catch (error) {
    console.error('Error fetching profile picture:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
