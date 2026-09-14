import { chromium } from '@playwright/test'

const baseUrl = process.env.HOMEPAGE_QA_URL || 'http://127.0.0.1:3417'
const browser = await chromium.launch({ headless: true })
const sizes = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
]

const report = []
for (const size of sizes) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.locator('#homepage-hero-title').waitFor({ state: 'visible', timeout: 60_000 })
  await page.locator('.vb-home-paths').waitFor({ state: 'attached', timeout: 60_000 })

  const readPrimaryCta = async () => {
    const cta = page.locator('.vb-site-header [data-home-primary-cta]').first()
    return {
      label: (await cta.textContent())?.trim(),
      href: await cta.getAttribute('href'),
    }
  }
  const primaryCtaBeforeAuthSettles = await readPrimaryCta()
  await page.waitForTimeout(900)
  const primaryCtaAfterAuthSettles = await readPrimaryCta()

  await page.waitForFunction(
    () => document.querySelector('.vb-decision-console')?.getAttribute('data-beat') === '0',
    undefined,
    { timeout: 5_000 },
  )
  const beatZeroComposition = await page.evaluate(() => {
    const rectFor = (selector) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect()
      return rect ? { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height } : null
    }
    const goal = rectFor('.vb-decision-console__goal')
    const evidence = rectFor('.vb-decision-console__evidence')
    const canvas = rectFor('.vb-decision-console__canvas')
    const evidenceNode = document.querySelector('.vb-decision-console__evidence')
    const evidenceHidden = Boolean(evidenceNode && (
      getComputedStyle(evidenceNode).visibility === 'hidden' || Number.parseFloat(getComputedStyle(evidenceNode).opacity) <= 0.01
    ))
    const geometricOverlap = Boolean(goal && evidence &&
      goal.bottom > evidence.top && goal.top < evidence.bottom && goal.right > evidence.left && goal.left < evidence.right)
    return {
      requestedBeat: 0,
      renderedBeat: document.querySelector('.vb-decision-console')?.getAttribute('data-beat'),
      goalWithinCanvas: Boolean(goal && canvas && goal.top >= canvas.top - 1 && goal.bottom <= canvas.bottom + 1),
      evidenceHiddenOnMobile: window.innerWidth > 640 || evidenceHidden,
      noVisibleOverlap: evidenceHidden || !geometricOverlap,
      goal,
      evidence,
    }
  })
  if (
    beatZeroComposition.renderedBeat !== '0' ||
    !beatZeroComposition.goalWithinCanvas ||
    !beatZeroComposition.evidenceHiddenOnMobile ||
    !beatZeroComposition.noVisibleOverlap
  ) {
    throw new Error(`Invalid ${size.name} beat 0 composition: ${JSON.stringify(beatZeroComposition)}`)
  }

  const foldPath = `/tmp/vestblock-home-v2-${size.name}-fold.png`
  const fullPath = `/tmp/vestblock-home-v2-${size.name}-full.png`
  await page.screenshot({ path: foldPath })
  await page.screenshot({ path: fullPath, fullPage: true })

  const beatPaths = []
  const beatCompositions = []
  for (let beat = 1; beat <= 2; beat += 1) {
    await page.evaluate((beatNumber) => {
      const element = document.querySelector(`[data-operator-beat="${beatNumber}"]`)
      if (!element) throw new Error(`Missing scroll beat ${beatNumber}`)
      const rect = element.getBoundingClientRect()
      const targetY = window.innerHeight * (window.innerWidth <= 1100 ? 0.72 : 0.81)
      const center = rect.top + window.scrollY + rect.height / 2
      window.scrollTo(0, Math.max(0, center - targetY))
    }, beat)
    await page.waitForFunction(
      (beatNumber) => document.querySelector('.vb-decision-console')?.getAttribute('data-beat') === String(beatNumber),
      beat,
      { timeout: 5_000 },
    )
    await page.waitForTimeout(700)
    const composition = await page.evaluate((beatNumber) => {
      const getRect = (selector) => {
        const rect = document.querySelector(selector)?.getBoundingClientRect()
        return rect ? { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height } : null
      }
      const consoleRect = getRect('.vb-decision-console')
      const canvasRect = getRect('.vb-decision-console__canvas')
      const headerRect = getRect('.vb-site-header')
      const selectors = beatNumber === 1
        ? ['.vb-decision-console__evidence']
        : ['.vb-decision-console__route', '.vb-decision-console__record']
      const panels = selectors.map((selector) => ({ selector, rect: getRect(selector) }))
      const staleSelectors = beatNumber === 1
        ? ['.vb-decision-console__goal']
        : ['.vb-decision-console__goal', '.vb-decision-console__evidence']
      const stalePanelsHidden = window.innerWidth > 1100 || staleSelectors.every((selector) => {
        const node = document.querySelector(selector)
        return node && Number.parseFloat(getComputedStyle(node).opacity) <= 0.01
      })
      const withinCanvas = panels.every(({ rect }) => rect && canvasRect && rect.top >= canvasRect.top - 1 && rect.bottom <= canvasRect.bottom + 1)
      const noPanelOverlap = panels.length < 2 || !(
        panels[0].rect && panels[1].rect &&
        panels[0].rect.bottom > panels[1].rect.top &&
        panels[0].rect.top < panels[1].rect.bottom &&
        panels[0].rect.right > panels[1].rect.left &&
        panels[0].rect.left < panels[1].rect.right
      )
      return {
        requestedBeat: beatNumber,
        renderedBeat: document.querySelector('.vb-decision-console')?.getAttribute('data-beat'),
        consoleBelowHeader: Boolean(consoleRect && headerRect && consoleRect.top >= headerRect.bottom - 1),
        consoleWithinViewport: Boolean(consoleRect && consoleRect.bottom <= window.innerHeight + 1),
        withinCanvas,
        noPanelOverlap,
        stalePanelsHidden,
        panels,
      }
    }, beat)
    if (
      composition.renderedBeat !== String(beat) ||
      !composition.consoleBelowHeader ||
      !composition.consoleWithinViewport ||
      !composition.withinCanvas ||
      !composition.noPanelOverlap ||
      !composition.stalePanelsHidden
    ) {
      throw new Error(`Invalid ${size.name} beat ${beat} composition: ${JSON.stringify(composition)}`)
    }
    const beatPath = `/tmp/vestblock-home-v2-${size.name}-beat-${beat + 1}.png`
    await page.screenshot({ path: beatPath })
    beatPaths.push(beatPath)
    beatCompositions.push(composition)
  }

  const outcomes = []
  await page.locator('#choose-your-path').scrollIntoViewIfNeeded()
  for (let index = 0; index < 4; index += 1) {
    const button = page.locator('.vb-home-paths__choices button').nth(index)
    await button.evaluate((element) => element.click())
    await page.waitForTimeout(80)
    outcomes.push({
      label: (await button.textContent())?.replace(/\s+/g, ' ').trim(),
      pressed: await button.getAttribute('aria-pressed'),
      proofOutcome: await page.locator('.vb-home-proof').getAttribute('data-outcome'),
      proofObjective: (await page.locator('.vb-roadmap-sheet__summary > div').first().textContent())?.replace(/\s+/g, ' ').trim(),
    })
  }

  const metrics = await page.evaluate(() => {
    const root = document.documentElement
    const hero = document.querySelector('.vb-operator-hero')
    const selector = document.querySelector('#choose-your-path')
    const header = document.querySelector('.vb-site-header')
    const meaningfulSelectors = [
      '.vb-home-kicker',
      '.vb-operator-hero__assurance',
      '.vb-decision-console__bar',
      '.vb-decision-console__panel-head',
      '.vb-decision-console__panel p',
      '.vb-decision-console__panel li',
      '.vb-home-paths__preview header',
      '.vb-home-paths__shortcuts a',
      '.vb-home-paths__preview dt',
      '.vb-roadmap-sheet__summary span',
      '.vb-roadmap-sheet li p',
      '.vb-deal-record li p',
    ]
    const undersized = meaningfulSelectors.flatMap((selectorText) =>
      Array.from(document.querySelectorAll(selectorText))
        .filter((node) => {
          const style = getComputedStyle(node)
          return style.display !== 'none' && style.visibility !== 'hidden' && Number.parseFloat(style.fontSize) < 12
        })
        .map((node) => ({ selector: selectorText, px: Number.parseFloat(getComputedStyle(node).fontSize), text: node.textContent?.trim().slice(0, 50) })),
    )

    const parseColor = (value) => {
      const values = value.match(/[\d.]+/g)?.map(Number) || []
      return { r: values[0] || 0, g: values[1] || 0, b: values[2] || 0, a: values.length > 3 ? values[3] : 1 }
    }
    const luminance = ({ r, g, b }) => {
      const linear = [r, g, b].map((channel) => {
        const value = channel / 255
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      })
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
    }
    const ratio = (foreground, background) => {
      const fg = parseColor(foreground)
      const bg = parseColor(background)
      const composite = {
        r: fg.r * fg.a + bg.r * (1 - fg.a),
        g: fg.g * fg.a + bg.g * (1 - fg.a),
        b: fg.b * fg.a + bg.b * (1 - fg.a),
      }
      const values = [luminance(composite), luminance(bg)].sort((a, b) => b - a)
      return Number(((values[0] + 0.05) / (values[1] + 0.05)).toFixed(2))
    }
    const contrastProbe = (key, selectorText, background) => {
      const node = document.querySelector(selectorText)
      const color = node ? getComputedStyle(node).color : 'rgb(0, 0, 0)'
      return { key, selector: selectorText, color, background, ratio: ratio(color, background) }
    }
    const contrastRelevant = [
      contrastProbe('selected outcome header', '.vb-home-paths__preview header', 'rgb(236, 236, 228)'),
      contrastProbe('definition label', '.vb-home-paths__preview dt', 'rgb(236, 236, 228)'),
      contrastProbe('roadmap label', '.vb-roadmap-sheet__summary span', 'rgb(238, 239, 232)'),
      contrastProbe('roadmap footer', '.vb-roadmap-sheet footer', 'rgb(238, 239, 232)'),
      contrastProbe('DealVault footer', '.vb-deal-record footer', 'rgb(11, 16, 15)'),
      contrastProbe('inactive hero step', '.vb-operator-hero__steps article:not([data-active]) > p', 'rgb(7, 11, 10)'),
    ]
    return {
      overflow: root.scrollWidth - root.clientWidth,
      pageHeight: root.scrollHeight,
      heroHeight: Math.round(hero?.getBoundingClientRect().height || 0),
      selectorStartPx: Math.round((selector?.getBoundingClientRect().top || 0) + window.scrollY),
      selectorStartViewports: Number((((selector?.getBoundingClientRect().top || 0) + window.scrollY) / window.innerHeight).toFixed(2)),
      headerBackground: header ? getComputedStyle(header).backgroundColor : null,
      h1: document.querySelector('h1')?.textContent?.trim(),
      navLabels: Array.from(document.querySelectorAll('.vb-site-header nav a')).slice(0, 4).map((node) => node.textContent?.trim()),
      outcomeCount: document.querySelectorAll('.vb-home-paths__choices button').length,
      meaningfulTextUnder12px: undersized,
      contrastRelevant,
    }
  })

  report.push({
    ...size,
    ...metrics,
    primaryCtaBeforeAuthSettles,
    primaryCtaAfterAuthSettles,
    primaryCtaStable: JSON.stringify(primaryCtaBeforeAuthSettles) === JSON.stringify(primaryCtaAfterAuthSettles),
    screenshots: { foldPath, fullPath, beatPaths },
    beatZeroComposition,
    beatCompositions,
    outcomes,
    pageErrors,
  })
  await context.close()
}

const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
const reducedPage = await reduced.newPage()
await reducedPage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await reducedPage.locator('#homepage-hero-title').waitFor({ state: 'visible', timeout: 60_000 })
const reducedMotion = await reducedPage.evaluate(() => ({
  panelTransition: getComputedStyle(document.querySelector('.vb-decision-console__panel')).transitionDuration,
  railTransition: getComputedStyle(document.querySelector('.vb-decision-console__rail span')).transitionDuration,
  htmlScrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
}))
await reduced.close()
await browser.close()

console.log(JSON.stringify({ report, reducedMotion }, null, 2))
