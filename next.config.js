/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        // Cache control for static assets (JS, CSS) - short TTL to prevent stale code
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, immutable', // 1 hour cache
          },
        ],
      },
      {
        // CORS configuration for API routes
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NODE_ENV === 'production'
              ? 'https://koregous.vercel.app'
              : 'http://localhost:3000',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400', // 24 hours
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
        ],
      },
      {
        // Security headers for all routes EXCEPT embed
        source: '/((?!embed).*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live", // Next.js needs unsafe-inline
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:", // Allow Cloudinary and data URLs
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co https://vercel.live wss://*.supabase.co https://*.r2.cloudflarestorage.com", // Supabase + Vercel + R2
              "media-src 'self' https: blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
          // Strict Transport Security (HSTS)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
      {
        // Allow embed routes to be displayed in iframes from ANY origin
        // This MUST come after the general security headers
        source: '/embed/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors *", // Allow all origins to embed
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
