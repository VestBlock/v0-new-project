import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const baseUrl = process.env.HOMEPAGE_QA_URL || 'http://127.0.0.1:3417'
const artifactDirectory = resolve(process.cwd(), 'output/playwright/homepage-v3')

mkdirSync(artifactDirectory, { recursive: true })

const sizes = [
  { name: 'wide', width: 1440, height: 1000 },
  { name: 'tablet', width: 1024, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

const paths = [
  { id: 'funding', label: 'Funding', href: '/capital' },
  { id: 'real-estate', label: 'Deals', href: '/real-estate' },
  { id: 'opportunity', label: 'Opportunity', href: '/opportunity' },
]

const formatConsoleMessage = (message) => ({
  type: message.type(),
  text: message.text(),
  location: message.location(),
})

const readPageContract = async (page) => page.evaluate(() => {
  const root = document.documentElement
  const heroTitle = document.querySelector('#homepage-hero-title')
  const hero = heroTitle?.closest('section') || heroTitle?.parentElement
  const pathDirectory = document.querySelector('#choose-your-path')
  const steps = document.querySelector('[data-home-steps]')
  const trust = document.querySelector('[data-home-trust]')
  const dealVault = document.querySelector('[data-home-dealvault]')
  const finalCta = document.querySelector('[data-home-final-cta]')
  const visible = (node) => {
    if (!(node instanceof HTMLElement)) return false
    const style = getComputedStyle(node)
    const rect = node.getBoundingClientRect()
    return style.display !== 'none' && style.visibility !== 'hidden' && Number.parseFloat(style.opacity) > 0.01 && rect.width > 0 && rect.height > 0
  }
  const hrefOf = (node) => node?.getAttribute('href') || null
  const boxOf = (node) => {
    if (!(node instanceof HTMLElement)) return null
    const rect = node.getBoundingClientRect()
    return {
      width: Number(rect.width.toFixed(1)),
      height: Number(rect.height.toFixed(1)),
    }
  }

  const expectedHrefs = {
    funding: '/capital',
    'real-estate': '/real-estate',
    opportunity: '/opportunity',
  }
  const pathCards = ['funding', 'real-estate', 'opportunity'].map((id) => {
    const card = pathDirectory?.querySelector(`[data-home-path="${id}"]`)
    const link = card?.matches(`a[href="${expectedHrefs[id]}"]`)
      ? card
      : card?.querySelector(`a[href="${expectedHrefs[id]}"]`)
    return {
      id,
      visible: visible(card),
      href: hrefOf(link),
      heading: card?.querySelector('h2, h3')?.textContent?.replace(/\s+/g, ' ').trim() || null,
      text: card?.textContent?.replace(/\s+/g, ' ').trim() || null,
    }
  })

  const primaryCtas = Array.from(document.querySelectorAll('main a[data-home-primary-cta]')).map((node) => ({
    text: node.textContent?.replace(/\s+/g, ' ').trim() || '',
    href: hrefOf(node),
    visible: visible(node),
  }))

  const tapTargets = Array.from(document.querySelectorAll('main a[href], main button'))
    .filter((node) => visible(node) && !node.closest('[data-qa-inline-link]'))
    .map((node) => ({
      tag: node.tagName.toLowerCase(),
      text: node.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) || '',
      href: hrefOf(node),
      ...boxOf(node),
    }))

  const undersizedTapTargets = tapTargets.filter(({ width, height }) => width < 44 || height < 44)
  const visibleTextUnder12px = Array.from(document.querySelectorAll('main p, main li, main dt, main dd, main small'))
    .filter((node) => visible(node) && Number.parseFloat(getComputedStyle(node).fontSize) < 12)
    .map((node) => ({
      px: Number.parseFloat(getComputedStyle(node).fontSize),
      text: node.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) || '',
    }))

  const headings = Array.from(document.querySelectorAll('main h1, main h2, main h3'))
    .filter(visible)
    .map((node) => ({ level: Number(node.tagName.slice(1)), text: node.textContent?.replace(/\s+/g, ' ').trim() || '' }))

  return {
    title: document.title,
    h1Count: document.querySelectorAll('main h1').length,
    heroTitle: heroTitle?.textContent?.replace(/\s+/g, ' ').trim() || null,
    heroPrimaryHref: hrefOf(hero?.querySelector('a[data-home-primary-cta]')),
    overflow: root.scrollWidth - root.clientWidth,
    pageHeight: root.scrollHeight,
    headings,
    pathCards,
    pathDirectoryVisible: visible(pathDirectory),
    primaryCtas,
    stepCount: steps?.querySelectorAll('[data-home-step]').length
      || steps?.querySelector('ol')?.querySelectorAll(':scope > li').length
      || 0,
    stepsVisible: visible(steps),
    trustVisible: visible(trust),
    dealVaultVisible: visible(dealVault),
    dealVaultHref: hrefOf(dealVault?.querySelector('a[href^="/dealvault"]')),
    finalCtaVisible: visible(finalCta),
    finalCtaHref: hrefOf(finalCta?.querySelector('a[data-home-primary-cta], a[href="/next-move"]')),
    sectionHeadings: [pathDirectory, steps, trust, dealVault, finalCta].map((section) => (
      section?.querySelector('h2')?.textContent?.replace(/\s+/g, ' ').trim() || null
    )),
    undersizedTapTargets,
    visibleTextUnder12px,
  }
})

const browser = await chromium.launch({ headless: true })
const report = []

try {
  for (const size of sizes) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      reducedMotion: 'no-preference',
    })
    const page = await context.newPage()
    const consoleErrors = []
    const pageErrors = []
    const failedRequests = []

    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(formatConsoleMessage(message))
    })
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('requestfailed', (request) => {
      const error = request.failure()?.errorText || 'unknown request failure'
      // Next.js may cancel a speculative RSC prefetch after the document is
      // ready. That browser-side cancellation is not a production request
      // failure and should not hide real DNS, HTTP, or asset errors.
      if (error === 'net::ERR_ABORTED' && request.url().includes('_rsc=')) return
      failedRequests.push({ url: request.url(), error })
    })

    const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    assert(response?.ok(), `${size.name}: homepage returned ${response?.status() || 'no response'}`)
    await page.locator('#homepage-hero-title').waitFor({ state: 'visible', timeout: 60_000 })
    await page.locator('#choose-your-path').waitFor({ state: 'visible', timeout: 60_000 })
    await page.evaluate(() => document.fonts?.ready)
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const contract = await readPageContract(page)
    const foldPath = resolve(artifactDirectory, `${size.name}-fold.png`)
    const fullPath = resolve(artifactDirectory, `${size.name}-full.png`)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.screenshot({ path: foldPath })
    await page.screenshot({ path: fullPath, fullPage: true })

    assert.equal(contract.h1Count, 1, `${size.name}: homepage must contain exactly one h1`)
    assert.equal(contract.heroTitle, 'Find your next move.', `${size.name}: hero promise changed`)
    assert.equal(contract.heroPrimaryHref, '/next-move', `${size.name}: hero primary CTA must route to /next-move`)
    assert(contract.pathDirectoryVisible, `${size.name}: #choose-your-path must be visible`)
    assert.equal(contract.pathCards.length, 3, `${size.name}: three path cards are required`)

    for (const expectedPath of paths) {
      const actualPath = contract.pathCards.find(({ id }) => id === expectedPath.id)
      assert(actualPath?.visible, `${size.name}: ${expectedPath.label} card is not visible`)
      assert.equal(actualPath?.href, expectedPath.href, `${size.name}: ${expectedPath.label} must link to ${expectedPath.href}`)
      assert(actualPath?.text?.toLocaleLowerCase().includes(expectedPath.label.toLocaleLowerCase()), `${size.name}: ${expectedPath.label} label is missing`)

      const destination = await context.request.get(new URL(expectedPath.href, baseUrl).toString())
      assert(destination.ok(), `${size.name}: ${expectedPath.href} returned ${destination.status()}`)
    }

    assert(contract.stepsVisible, `${size.name}: compact three-step explanation is missing`)
    assert.equal(contract.stepCount, 3, `${size.name}: explanation must contain exactly three steps`)
    assert(contract.trustVisible, `${size.name}: trust-boundary section is missing`)
    assert(contract.dealVaultVisible, `${size.name}: DealVault section is missing`)
    assert(contract.dealVaultHref?.startsWith('/dealvault'), `${size.name}: DealVault section needs a DealVault link`)
    assert(contract.finalCtaVisible, `${size.name}: final CTA section is missing`)
    assert.equal(contract.finalCtaHref, '/next-move', `${size.name}: final primary CTA must route to /next-move`)
    assert(contract.sectionHeadings.every(Boolean), `${size.name}: every major section needs a visible h2: ${JSON.stringify(contract.sectionHeadings)}`)
    assert(contract.primaryCtas.length >= 2, `${size.name}: hero and final primary CTAs must be identifiable`)
    assert(contract.primaryCtas.every(({ href, visible }) => href === '/next-move' && visible), `${size.name}: every primary CTA must be visible and route to /next-move`)
    assert.equal(contract.visibleTextUnder12px.length, 0, `${size.name}: meaningful text is rendered below 12px: ${JSON.stringify(contract.visibleTextUnder12px)}`)
    assert.equal(consoleErrors.length, 0, `${size.name}: console errors: ${JSON.stringify(consoleErrors)}`)
    assert.equal(pageErrors.length, 0, `${size.name}: page errors: ${JSON.stringify(pageErrors)}`)
    assert.equal(failedRequests.length, 0, `${size.name}: request failures: ${JSON.stringify(failedRequests)}`)

    if (size.width === 390 || size.width === 1024) {
      assert.equal(contract.overflow, 0, `${size.name}: horizontal overflow must be exactly zero`)
      assert.equal(contract.undersizedTapTargets.length, 0, `${size.name}: tap targets below 44x44: ${JSON.stringify(contract.undersizedTapTargets)}`)
    }

    report.push({
      ...size,
      ...contract,
      consoleErrors,
      pageErrors,
      failedRequests,
      screenshots: { foldPath, fullPath },
    })
    await context.close()
  }

  const reducedContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  const reducedPage = await reducedContext.newPage()
  const reducedErrors = []
  reducedPage.on('pageerror', (error) => reducedErrors.push(error.message))

  await reducedPage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await reducedPage.locator('#homepage-hero-title').waitFor({ state: 'visible', timeout: 60_000 })
  await reducedPage.waitForTimeout(250)

  const reducedMotion = await reducedPage.evaluate(() => {
    const main = document.querySelector('main')
    const parseDurations = (value) => value.split(',').map((part) => {
      const duration = Number.parseFloat(part)
      return part.trim().endsWith('ms') ? duration : duration * 1000
    })
    const motionNodes = Array.from(document.querySelectorAll('main [data-motion], main [class*="motion"], main svg'))
      .filter((node) => node instanceof HTMLElement || node instanceof SVGElement)
      .map((node) => {
        const style = getComputedStyle(node)
        return {
          tag: node.tagName.toLowerCase(),
          className: typeof node.className === 'string' ? node.className : node.getAttribute('class') || '',
          animationMs: Math.max(0, ...parseDurations(style.animationDuration)),
          transitionMs: Math.max(0, ...parseDurations(style.transitionDuration)),
        }
      })
    const activeAnimations = main?.getAnimations({ subtree: true })
      .filter((animation) => animation.playState === 'running')
      .map((animation) => ({
        duration: animation.effect?.getTiming().duration,
        iterations: animation.effect?.getTiming().iterations,
      })) || []

    return {
      htmlScrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      activeAnimations,
      nonReducedMotionNodes: motionNodes.filter(({ animationMs, transitionMs }) => animationMs > 1 || transitionMs > 1),
    }
  })

  assert.equal(reducedErrors.length, 0, `reduced motion: page errors: ${JSON.stringify(reducedErrors)}`)
  assert.notEqual(reducedMotion.htmlScrollBehavior, 'smooth', 'reduced motion: smooth scrolling must be disabled')
  assert.equal(reducedMotion.activeAnimations.length, 0, `reduced motion: active animations found: ${JSON.stringify(reducedMotion.activeAnimations)}`)
  assert.equal(reducedMotion.nonReducedMotionNodes.length, 0, `reduced motion: animated elements retain motion: ${JSON.stringify(reducedMotion.nonReducedMotionNodes)}`)

  await reducedContext.close()
  console.log(JSON.stringify({ baseUrl, artifactDirectory, report, reducedMotion }, null, 2))
} finally {
  await browser.close()
}
