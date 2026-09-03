import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://loop-gpt.cyou'

const ROUTES = ['', '/developers', '/login', '/signup', '/privacy', '/terms', '/cookies', '/acceptable-use']

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : path === '/developers' ? 0.9 : 0.5,
  }))
}
