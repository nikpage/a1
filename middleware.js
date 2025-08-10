import { NextResponse } from 'next/server'

const rateLimitMap = new Map()

export function middleware(request) {
  const ip = request.ip || 'anonymous'
  const now = Date.now()
  const windowMs = 60 * 60 * 1000 // 1 hour
  const maxRequests = 5

  // Clean old entries
  const cutoff = now - windowMs
  for (const [key, data] of rateLimitMap.entries()) {
    if (data.resetTime < cutoff) {
      rateLimitMap.delete(key)
    }
  }

  // Check current IP
  const current = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs }

  if (current.count >= maxRequests) {
    return new NextResponse('Rate limited', { status: 429 })
  }

  current.count++
  rateLimitMap.set(ip, current)

  return NextResponse.next()
}

export const config = {
  matcher: '/api/analyze'  // Change this to match your actual CV analysis route
}
