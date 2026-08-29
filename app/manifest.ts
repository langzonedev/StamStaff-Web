import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StamStaff Prototype',
    short_name: 'StamStaff',
    description: 'A fictional prototype for simple event availability and rostering.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8f3e8',
    theme_color: '#175d4b',
    orientation: 'portrait-primary',
    icons: [{ src: '/og.png', sizes: '1536x864', type: 'image/png', purpose: 'any' }],
  };
}
