'use client'

import { Check, Sparkles, Zap, Shield, Heart } from 'lucide-react'
import PremiumBadge from '@/shared/components/PremiumBadge'

const FEATURES = [
  {
    icon: '💾',
    title: '10GB Storage',
    description: '20x more space than free tier',
    detail: 'Store thousands of high-quality images, videos, and audio files'
  },
  {
    icon: '📚',
    title: 'Unlimited Sections',
    description: 'Build endless collections',
    detail: 'No more 50-section limit. Create as many collections as you want'
  },
  {
    icon: '🎵',
    title: '3-5 Music Blocks',
    description: 'Rich audio experiences',
    detail: 'Embed multiple music tracks to set the perfect mood'
  },
  {
    icon: '🎬',
    title: 'Video Blocks',
    description: 'Premium-only feature',
    detail: 'Embed videos with custom styling and controls'
  },
  {
    icon: '✨',
    title: 'Animated Backgrounds',
    description: 'Glass morphism effects',
    detail: 'Set stunning video, GIF, or image backgrounds on your profile'
  },
  {
    icon: '👑',
    title: 'Premium Badge',
    description: 'Stand out as a curator',
    detail: 'Show off your premium status on your profile and creator cards'
  },
  {
    icon: '🚀',
    title: 'Early Access',
    description: 'New features first',
    detail: 'Get access to new blocks and features before everyone else'
  },
  {
    icon: '💬',
    title: 'Priority Support',
    description: 'Get help faster',
    detail: 'Jump to the front of the support queue'
  },
]

const FAQ = [
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes! Cancel anytime from your account settings. No questions asked.'
  },
  {
    question: 'What happens to my content if I cancel?',
    answer: 'Your sections stay published, but premium features (animated backgrounds, extra music blocks) will be disabled. You\'ll need to reduce storage under 500MB or sections under 50 to continue editing.'
  },
  {
    question: 'Do you offer refunds?',
    answer: 'Yes, we offer a 14-day money-back guarantee. If you\'re not happy, we\'ll refund your subscription.'
  },
  {
    question: 'Can I upgrade from monthly to yearly?',
    answer: 'Yes! You can switch plans anytime. We\'ll prorate the difference.'
  },
  {
    question: 'Is there a student discount?',
    answer: 'Not yet, but we\'re working on it! Email support@roomlet.app with your student ID.'
  },
]

export default function PremiumPageClient() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-pink-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-600/10 via-transparent to-transparent" />
        
        <div className="relative max-w-6xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <Sparkles className="text-purple-400" size={24} />
            <span className="text-purple-400 font-medium">Roomlet Premium</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
            Unlock Unlimited
            <br />
            Creative Power
          </h1>
          
          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
            Build stunning collections without limits. Premium gives you the storage, features, and flexibility to bring your vision to life.
          </p>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
            {/* Monthly Plan */}
            <div className="border border-gray-800 rounded-2xl p-8 bg-gray-900/50 hover:border-purple-500/50 transition relative">
              <div className="text-left">
                <h3 className="text-2xl font-semibold mb-2">Monthly</h3>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-5xl font-bold">$5</span>
                  <span className="text-gray-400">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <Check size={16} className="text-green-400 shrink-0" />
                    All premium features
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <Check size={16} className="text-green-400 shrink-0" />
                    Cancel anytime
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <Check size={16} className="text-green-400 shrink-0" />
                    14-day money-back guarantee
                  </li>
                </ul>
                <button className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg font-medium transition shadow-lg shadow-purple-500/20">
                  Start Free Trial
                </button>
                <p className="text-xs text-gray-500 mt-3 text-center">
                  7 days free, then $5/month
                </p>
              </div>
            </div>

            {/* Yearly Plan */}
            <div className="border-2 border-purple-500 rounded-2xl p-8 bg-gradient-to-br from-purple-900/20 to-pink-900/20 relative">
              {/* Best Value Badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="px-4 py-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-sm font-medium flex items-center gap-1">
                  <Zap size={14} />
                  Best Value
                </div>
              </div>
              
              <div className="text-left">
                <h3 className="text-2xl font-semibold mb-2">Yearly</h3>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-5xl font-bold">$48</span>
                  <span className="text-gray-400">/year</span>
                </div>
                <div className="text-sm text-green-400 font-medium mb-6">
                  Save $12 (20% off)
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <Check size={16} className="text-green-400 shrink-0" />
                    All premium features
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <Check size={16} className="text-green-400 shrink-0" />
                    Save 2 months
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <Check size={16} className="text-green-400 shrink-0" />
                    14-day money-back guarantee
                  </li>
                </ul>
                <button className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg font-medium transition shadow-lg shadow-purple-500/20">
                  Start Free Trial
                </button>
                <p className="text-xs text-gray-500 mt-3 text-center">
                  7 days free, then $48/year
                </p>
              </div>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="flex items-center justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Shield size={16} />
              <span>Secure payment</span>
            </div>
            <div className="flex items-center gap-2">
              <Heart size={16} />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={16} />
              <span>14-day guarantee</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Everything You Need</h2>
          <p className="text-gray-400 text-lg">
            Premium unlocks the full creative potential of Roomlet
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="border border-gray-800 rounded-xl p-6 hover:border-purple-500/50 transition bg-gray-900/30"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-purple-400 text-sm mb-3">{feature.description}</p>
              <p className="text-gray-500 text-sm leading-relaxed">{feature.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="max-w-4xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Free vs Premium</h2>
          <p className="text-gray-400 text-lg">
            See how Premium compares to the free tier
          </p>
        </div>

        <div className="border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="text-left p-4 font-semibold">Feature</th>
                <th className="text-center p-4 font-semibold">Free</th>
                <th className="text-center p-4 font-semibold">
                  <div className="inline-flex items-center gap-2">
                    Premium
                    <PremiumBadge size="sm" variant="gradient" showIcon={false} />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              <tr className="hover:bg-gray-900/30">
                <td className="p-4">Storage</td>
                <td className="text-center p-4 text-gray-400">500 MB</td>
                <td className="text-center p-4 text-purple-400 font-medium">10 GB</td>
              </tr>
              <tr className="hover:bg-gray-900/30">
                <td className="p-4">Sections</td>
                <td className="text-center p-4 text-gray-400">50</td>
                <td className="text-center p-4 text-purple-400 font-medium">Unlimited</td>
              </tr>
              <tr className="hover:bg-gray-900/30">
                <td className="p-4">Music Blocks</td>
                <td className="text-center p-4 text-gray-400">1</td>
                <td className="text-center p-4 text-purple-400 font-medium">3-5</td>
              </tr>
              <tr className="hover:bg-gray-900/30">
                <td className="p-4">Video Blocks</td>
                <td className="text-center p-4 text-gray-600">✗</td>
                <td className="text-center p-4 text-green-400">✓</td>
              </tr>
              <tr className="hover:bg-gray-900/30">
                <td className="p-4">Animated Backgrounds</td>
                <td className="text-center p-4 text-gray-600">✗</td>
                <td className="text-center p-4 text-green-400">✓</td>
              </tr>
              <tr className="hover:bg-gray-900/30">
                <td className="p-4">Premium Badge</td>
                <td className="text-center p-4 text-gray-600">✗</td>
                <td className="text-center p-4 text-green-400">✓</td>
              </tr>
              <tr className="hover:bg-gray-900/30">
                <td className="p-4">Early Access</td>
                <td className="text-center p-4 text-gray-600">✗</td>
                <td className="text-center p-4 text-green-400">✓</td>
              </tr>
              <tr className="hover:bg-gray-900/30">
                <td className="p-4">Priority Support</td>
                <td className="text-center p-4 text-gray-600">✗</td>
                <td className="text-center p-4 text-green-400">✓</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Frequently Asked Questions</h2>
          <p className="text-gray-400 text-lg">
            Everything you need to know about Premium
          </p>
        </div>

        <div className="space-y-6">
          {FAQ.map((item) => (
            <div
              key={item.question}
              className="border border-gray-800 rounded-xl p-6 hover:border-purple-500/50 transition"
            >
              <h3 className="text-lg font-semibold mb-2">{item.question}</h3>
              <p className="text-gray-400 leading-relaxed">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto px-6 py-24">
        <div className="border border-purple-500/50 rounded-2xl p-12 text-center bg-gradient-to-br from-purple-900/20 to-pink-900/20">
          <Sparkles className="mx-auto mb-6 text-purple-400" size={48} />
          <h2 className="text-4xl font-bold mb-4">
            Ready to Upgrade?
          </h2>
          <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
            Join hundreds of premium curators building beautiful collections without limits.
          </p>
          <button className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg font-medium text-lg transition shadow-lg shadow-purple-500/20">
            Start Your Free Trial
          </button>
          <p className="text-sm text-gray-500 mt-4">
            7 days free • No credit card required • Cancel anytime
          </p>
        </div>
      </div>
    </div>
  )
}
