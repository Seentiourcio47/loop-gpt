import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://loop-gpt.cyou'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/account', '/reset', '/verify'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
