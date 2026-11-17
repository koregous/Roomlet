/**
 * Feed API Test Script
 * 
 * Tests both JSON and RSS feed endpoints with various query parameters.
 * Run with: node scripts/test-feed-api.js
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green')
}

function logError(message) {
  log(`✗ ${message}`, 'red')
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue')
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow')
}

async function testEndpoint(name, url) {
  log(`\n${'='.repeat(60)}`, 'cyan')
  log(`Testing: ${name}`, 'cyan')
  log(`URL: ${url}`, 'cyan')
  log('='.repeat(60), 'cyan')

  try {
    const startTime = Date.now()
    const response = await fetch(url)
    const duration = Date.now() - startTime

    logInfo(`Status: ${response.status} ${response.statusText}`)
    logInfo(`Duration: ${duration}ms`)
    logInfo(`Content-Type: ${response.headers.get('content-type')}`)

    if (response.ok) {
      logSuccess('Request successful')

      const contentType = response.headers.get('content-type')
      
      if (contentType?.includes('application/json')) {
        const data = await response.json()
        logInfo(`Items returned: ${data.items?.length || 0}`)
        logInfo(`Has more: ${data.has_more}`)
        
        if (data.cursor) {
          logInfo(`Cursor: ${data.cursor}`)
        }

        if (data.items?.length > 0) {
          const firstItem = data.items[0]
          log('\nFirst item:', 'yellow')
          console.log(JSON.stringify({
            id: firstItem.id,
            title: firstItem.title,
            category: firstItem.category.name,
            creator: firstItem.creator.display_name,
            published_at: firstItem.published_at,
            view_count: firstItem.view_count,
          }, null, 2))
        } else {
          logWarning('No items returned (database might be empty)')
        }
      } else if (contentType?.includes('xml')) {
        const text = await response.text()
        logInfo(`RSS Feed length: ${text.length} bytes`)
        
        // Count items in RSS
        const itemCount = (text.match(/<item>/g) || []).length
        logInfo(`RSS Items: ${itemCount}`)

        if (itemCount === 0) {
          logWarning('No RSS items found (database might be empty)')
        }
      }

      return true
    } else {
      logError(`Request failed: ${response.status}`)
      const error = await response.text()
      console.log(error)
      return false
    }
  } catch (error) {
    logError(`Error: ${error.message}`)
    return false
  }
}

async function runTests() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'cyan')
  log('║           Roomlet Feed API Test Suite                     ║', 'cyan')
  log('╚════════════════════════════════════════════════════════════╝', 'cyan')
  
  logInfo(`Base URL: ${BASE_URL}`)
  logInfo(`Time: ${new Date().toISOString()}\n`)

  const results = []

  // Test 1: Basic JSON feed
  results.push(await testEndpoint(
    'JSON Feed - Basic',
    `${BASE_URL}/api/feed/latest?limit=5`
  ))

  // Test 2: JSON with category filter
  results.push(await testEndpoint(
    'JSON Feed - Photography Category',
    `${BASE_URL}/api/feed/latest?category=photography&limit=5`
  ))

  // Test 3: JSON with timestamp
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  results.push(await testEndpoint(
    'JSON Feed - Since Yesterday',
    `${BASE_URL}/api/feed/latest?since=${yesterday.toISOString()}&limit=5`
  ))

  // Test 4: JSON with invalid category (should 404)
  results.push(await testEndpoint(
    'JSON Feed - Invalid Category (should fail)',
    `${BASE_URL}/api/feed/latest?category=invalid-category`
  ))

  // Test 5: Basic RSS feed
  results.push(await testEndpoint(
    'RSS Feed - Basic',
    `${BASE_URL}/api/feed/rss?limit=10`
  ))

  // Test 6: RSS with category
  results.push(await testEndpoint(
    'RSS Feed - Art Category',
    `${BASE_URL}/api/feed/rss?category=art`
  ))

  // Test 7: Large limit (should cap at 50)
  results.push(await testEndpoint(
    'JSON Feed - Large Limit (should cap at 50)',
    `${BASE_URL}/api/feed/latest?limit=100`
  ))

  // Summary
  log('\n╔════════════════════════════════════════════════════════════╗', 'cyan')
  log('║                     Test Summary                           ║', 'cyan')
  log('╚════════════════════════════════════════════════════════════╝', 'cyan')

  const passed = results.filter(r => r).length
  const failed = results.filter(r => !r).length
  const total = results.length

  log(`\nTotal tests: ${total}`, 'blue')
  logSuccess(`Passed: ${passed}`)
  
  if (failed > 0) {
    logError(`Failed: ${failed}`)
  }

  const successRate = ((passed / total) * 100).toFixed(1)
  log(`\nSuccess rate: ${successRate}%\n`, successRate === '100.0' ? 'green' : 'yellow')

  if (successRate === '100.0') {
    logSuccess('All tests passed! 🎉')
  } else {
    logWarning('Some tests failed. Check the output above.')
  }

  process.exit(failed > 0 ? 1 : 0)
}

// Run the tests
runTests().catch(error => {
  logError(`Fatal error: ${error.message}`)
  process.exit(1)
})
