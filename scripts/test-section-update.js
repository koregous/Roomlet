/**
 * Manual test script for section update API endpoint
 * Tests the PUT /api/sections/[id] endpoint with item index synchronization
 * 
 * Usage:
 *   1. Set SECTION_ID, AUTH_TOKEN, and API_URL environment variables
 *   2. Run: node scripts/test-section-update.js
 */

const SECTION_ID = process.env.SECTION_ID || 'your-section-id-here'
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'your-auth-token-here'
const API_URL = process.env.API_URL || 'http://localhost:3000'

// Test payload - update with sample blocks
const testPayload = {
  title: 'Updated Test Section',
  blocks: [
    {
      id: 'block-1',
      type: 'image',
      content: {
        image: {
          url: 'https://example.com/test-image-1.jpg',
          caption: 'Test caption',
          alt: 'Test alt text'
        }
      },
      position: 0
    },
    {
      id: 'block-2',
      type: 'gallery',
      content: {
        images: [
          { url: 'https://example.com/gallery-1.jpg', caption: 'Gallery 1' },
          { url: 'https://example.com/gallery-2.jpg', caption: 'Gallery 2' }
        ]
      },
      position: 1
    }
  ],
  visible: true,
  is_nsfw: false
}

async function testSectionUpdate() {
  console.log('🧪 Testing PUT /api/sections/[id] endpoint')
  console.log(`📍 Target: ${API_URL}/api/sections/${SECTION_ID}`)
  console.log(`📦 Payload:`, JSON.stringify(testPayload, null, 2))
  console.log('\n🔄 Sending request...\n')

  try {
    const response = await fetch(`${API_URL}/api/sections/${SECTION_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Cookie': `sb-access-token=${AUTH_TOKEN}`
      },
      body: JSON.stringify(testPayload)
    })

    const data = await response.json()

    if (response.ok) {
      console.log('✅ SUCCESS - Section updated')
      console.log(`📄 Status: ${response.status}`)
      console.log(`📊 Response:`, JSON.stringify(data, null, 2))
      console.log('\n✨ Item index should now be synchronized')
      console.log('   Check database for item_index entries with section_id:', SECTION_ID)
    } else {
      console.log('❌ FAILED - Update rejected')
      console.log(`📄 Status: ${response.status}`)
      console.log(`⚠️  Error:`, data)
    }
  } catch (error) {
    console.log('💥 ERROR - Request failed')
    console.error(error)
  }
}

// Run test if SECTION_ID is provided
if (SECTION_ID === 'your-section-id-here') {
  console.log('⚠️  Please set SECTION_ID environment variable')
  console.log('   Example: SECTION_ID=abc-123 AUTH_TOKEN=xyz node scripts/test-section-update.js')
} else {
  testSectionUpdate()
}
