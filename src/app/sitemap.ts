import type { MetadataRoute } from 'next'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://taskit.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const mainPages = [
    { url: baseUrl, changeFrequency: 'weekly' as const, priority: 1.0 },
    { url: `${baseUrl}/features`, changeFrequency: 'weekly' as const, priority: 0.9 },
    { url: `${baseUrl}/pricing`, changeFrequency: 'weekly' as const, priority: 0.9 },
    { url: `${baseUrl}/about`, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${baseUrl}/security`, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${baseUrl}/integrations`, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${baseUrl}/resources`, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${baseUrl}/privacy`, changeFrequency: 'monthly' as const, priority: 0.3 },
    { url: `${baseUrl}/terms`, changeFrequency: 'monthly' as const, priority: 0.3 },
    { url: `${baseUrl}/cookies`, changeFrequency: 'monthly' as const, priority: 0.2 },
    { url: `${baseUrl}/dpa`, changeFrequency: 'monthly' as const, priority: 0.2 },
    { url: `${baseUrl}/acceptable-use`, changeFrequency: 'monthly' as const, priority: 0.2 },
    { url: `${baseUrl}/ai-transparency`, changeFrequency: 'monthly' as const, priority: 0.2 },
    { url: `${baseUrl}/fr`, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${baseUrl}/ar`, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${baseUrl}/compare`, changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${baseUrl}/compare/monday-vs-taskit`, changeFrequency: 'monthly' as const, priority: 0.6 },
  ]

  return mainPages.map((page) => ({
    ...page,
    lastModified: new Date(),
  }))
}
