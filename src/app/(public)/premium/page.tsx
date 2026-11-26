import { Metadata } from 'next'
import PremiumPageClient from './PremiumPageClient'

export const metadata: Metadata = {
  title: 'Roomlet Premium - Unlock Unlimited Creative Power',
  description: 'Upgrade to Roomlet Premium for 10GB storage, unlimited sections, animated backgrounds, music blocks, video blocks, and more. Starting at $5/month.',
  keywords: 'Roomlet Premium, upgrade, subscription, unlimited sections, 10GB storage, animated backgrounds',
}

export default function PremiumPage() {
  return <PremiumPageClient />
}
