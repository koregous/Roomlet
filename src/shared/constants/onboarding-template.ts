import { Block } from '@/shared/lib/types'

/**
 * Sample gallery images for the onboarding template section
 * These should be hosted on your R2 bucket or Cloudinary
 */
export const TEMPLATE_GALLERY_IMAGES = [
  'https://pub-1c2bb88bc39043e8a2e34708801df0ce.r2.dev/roomlet/30bb4d9f-a94c-452e-9807-3c9419589c0d/gallery/1786543715321-5e581659.webp',
  'https://pub-1c2bb88bc39043e8a2e34708801df0ce.r2.dev/roomlet/30bb4d9f-a94c-452e-9807-3c9419589c0d/gallery/1786543712243-1c10c902.jpg',
  'https://pub-1c2bb88bc39043e8a2e34708801df0ce.r2.dev/roomlet/30bb4d9f-a94c-452e-9807-3c9419589c0d/gallery/1786543604179-6bcbba8e.webp',
  'https://pub-1c2bb88bc39043e8a2e34708801df0ce.r2.dev/roomlet/30bb4d9f-a94c-452e-9807-3c9419589c0d/gallery/1786543607120-2a42cf33.webp',
  'https://pub-1c2bb88bc39043e8a2e34708801df0ce.r2.dev/roomlet/30bb4d9f-a94c-452e-9807-3c9419589c0d/gallery/1786543608489-bbc811c5.webp',
  'https://pub-1c2bb88bc39043e8a2e34708801df0ce.r2.dev/roomlet/30bb4d9f-a94c-452e-9807-3c9419589c0d/gallery/1786543610777-8721c8f9.webp',
  'https://pub-1c2bb88bc39043e8a2e34708801df0ce.r2.dev/roomlet/30bb4d9f-a94c-452e-9807-3c9419589c0d/gallery/1786543605072-768da110.webp',
  'https://pub-1c2bb88bc39043e8a2e34708801df0ce.r2.dev/roomlet/30bb4d9f-a94c-452e-9807-3c9419589c0d/gallery/1787473989711-99405ea6.jpg',
  'https://pub-1c2bb88bc39043e8a2e34708801df0ce.r2.dev/roomlet/30bb4d9f-a94c-452e-9807-3c9419589c0d/gallery/1787473985793-2cda87a5.webp',
]

/**
 * Template blocks for the welcome section created during onboarding
 */
export function createOnboardingBlocks(): Block[] {
  return [
    // Text block - Welcome message
    {
      id: crypto.randomUUID(),
      type: 'text',
      position: 0,
      content: {
        text: `**Welcome to Roomlet!** 🎨\n\nRoomlet is a platform for showcasing your collections, art, photography, and creative work. Build beautiful sections with text, images, galleries, music, and more. Share your unique profile with the world!\n\nThis is a sample section to get you started. Feel free to edit, delete, or create your own sections.`,
      },
    },

    // Links block - Important links
    {
      id: crypto.randomUUID(),
      type: 'links',
      position: 1,
      content: {
        links: [
          {
            title: 'Dashboard',
            url: 'https://koregous.vercel.app/dashboard',
            icon: 'layout-dashboard',
          },
          {
            title: 'Gallery',
            url: 'https://koregous.vercel.app/gallery',
            icon: 'image',
          },
          {
            title: 'Terms of Service',
            url: 'https://koregous.vercel.app/terms',
            icon: 'file-text',
          },
          {
            title: 'August (Developer)',
            url: 'https://koregous.vercel.app/august',
            icon: 'user',
          },
        ],
      },
    },

    // Quote block - Contact
    {
      id: crypto.randomUUID(),
      type: 'quote',
      position: 2,
      content: {
        quote: 'Have questions or feedback? We\'d love to hear from you!',
        author: 'Koregous@gmail.com',
        quoteStyle: 'card',
      },
    },

    // Divider
    {
      id: crypto.randomUUID(),
      type: 'divider',
      position: 3,
      content: {
        dividerStyle: 'gradient',
        spacing: 'medium',
      },
    },

    // Audio block - Sample music
    {
      id: crypto.randomUUID(),
      type: 'audio',
      position: 4,
      content: {
        audioUrl: 'https://mp3tourl.com/audio/1787473340592-8e330555-5292-4907-8fca-acfa9fb03e6c.mp3',
        audioTitle: 'Wolf (Acoustic)',
        audioArtist: 'Skott',
        audioCoverUrl: 'https://pub-1c2bb88bc39043e8a2e34708801df0ce.r2.dev/roomlet/1d7f46a6-a331-4e94-805b-41264b049696/gallery/1787473429302-754f48a6.webp',
        audioAutoPlay: false,
        loop: false,
        volume: 0.7,
      },
    },

    // Gallery block - Sample images
    {
      id: crypto.randomUUID(),
      type: 'gallery',
      position: 5,
      content: {
        images: TEMPLATE_GALLERY_IMAGES.map((url, index) => ({
          url,
          caption: `Sample Image ${index + 1}`,
          altText: `Sample gallery image ${index + 1}`,
        })),
        columns: 3,
        aspectRatio: '1/1',
        sortOrder: 'newest',
      },
    },
  ]
}

/**
 * Creates the template section data structure
 */
export function createOnboardingSection(profileId: string) {
  return {
    profile_id: profileId,
    title: 'Welcome to Roomlet',
    blocks: createOnboardingBlocks(),
    position: 0,
    visible: true,
    published: true, // Auto-publish so users can see it immediately
  }
}
