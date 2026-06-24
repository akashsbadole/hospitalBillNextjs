import type { NextConfig } from "next";

const cspDirectives = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://checkout.razorpay.com", "https://*.paypal.com"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", "data:", "blob:", "https://*.paypal.com"],
  'font-src': ["'self'", "data:"],
  'connect-src': ["'self'", "https://*.razorpay.com", "https://*.paypal.com", "ws://localhost:3001", "wss://*.railway.app"],
  'frame-src': ["'self'", "https://checkout.razorpay.com", "https://*.paypal.com"],
  'frame-ancestors': ["'none'"],
  'form-action': ["'self'"],
  'base-uri': ["'self'"],
};

const cspString = Object.entries(cspDirectives)
  .map(([key, values]) => `${key} ${values.join(' ')}`)
  .join('; ');

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
          { key: 'Content-Security-Policy', value: cspString },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },

  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'header', key: 'x-forwarded-proto', value: 'http' }],
        destination: 'https://:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
