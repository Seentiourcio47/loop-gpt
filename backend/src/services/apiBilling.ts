/**
 * Developer API pricing, plans and the prepaid USD balance ledger.
 *
 * Balances are stored as integer micro-USD (1_000_000 = $1) so per-token costs
 * stay exact — floating point dollars would drift over millions of requests.
 *
 * Rates deliberately undercut comparable gateways (abliteration.ai charges
 * $3/1M input and $3/1M output at time of writing).
 */
import { prisma, hasDb } from './prisma'
import { chatModelCatalog } from './chatModels'

/** 1 USD expressed in micro-USD. */
export const MICROS_PER_USD = 1_000_000

/** Per-million-token rates in micro-USD. */
export const RATE_CHAT_INPUT_PER_MTOK = 2 * MICROS_PER_USD // $2.00 / 1M tokens
export const RATE_CHAT_OUTPUT_PER_MTOK = 2 * MICROS_PER_USD // $2.00 / 1M tokens
/**
 * Large-tier rates. abliteration.ai charges $5/$5 per 1M for its large model,
 * so $3/$3 keeps the "cheaper on every axis" positioning.
 */
export const RATE_CHAT_LARGE_INPUT_PER_MTOK = 3 * MICROS_PER_USD // $3.00 / 1M tokens
export const RATE_CHAT_LARGE_OUTPUT_PER_MTOK = 3 * MICROS_PER_USD // $3.00 / 1M tokens
/** Cached input is billed at 10% of the standard input rate. */
export const CACHED_INPUT_DISCOUNT = 0.1

/** Per-tier chat rates, keyed by the tiers in `services/chatModels.ts`. */
export const CHAT_TIER_RATES: Record<string, { input: number; output: number }> = {
  standard: { input: RATE_CHAT_INPUT_PER_MTOK, output: RATE_CHAT_OUTPUT_PER_MTOK },
  large: { input: RATE_CHAT_LARGE_INPUT_PER_MTOK, output: RATE_CHAT_LARGE_OUTPUT_PER_MTOK },
}

export function chatRatesFor(tier?: string | null) {
  return CHAT_TIER_RATES[tier || 'standard'] || CHAT_TIER_RATES.standard
}

/** Flat per-unit rates in micro-USD. */
export const RATE_IMAGE = 50_000 // $0.05 per image
export const RATE_VIDEO = 400_000 // $0.40 per video

/** Free preview credit granted once, on first key creation (no card required). */
export const PREVIEW_CREDIT_MICROS = 1 * MICROS_PER_USD // $1.00

export interface ApiPlan {
  id: string
  name: string
  priceUsd: number
  /** Fractional discount applied to metered usage, e.g. 0.05 = 5% off. */
  discount: number
  /** Requests per minute allowed across all of the user's keys. */
  rateLimitPerMin: number
  /** Monthly credit included with the plan, in micro-USD. */
  includedCreditMicros: number
  highlights: string[]
}

/** `null` plan = pay-as-you-go on prepaid credit with no monthly fee. */
export const API_PLANS: Record<string, ApiPlan> = {
  developer: {
    id: 'developer',
    name: 'Developer',
    priceUsd: 15,
    discount: 0.05,
    rateLimitPerMin: 60,
    includedCreditMicros: 0,
    highlights: ['5% usage discount', '60 requests/min', 'Unlimited API keys', 'OpenAI-compatible /v1'],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    priceUsd: 40,
    discount: 0.1,
    rateLimitPerMin: 300,
    includedCreditMicros: 0,
    highlights: ['10% usage discount', '300 requests/min', 'Priority queue', 'Usage analytics'],
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    priceUsd: 150,
    discount: 0.15,
    rateLimitPerMin: 600,
    includedCreditMicros: 150 * MICROS_PER_USD,
    highlights: ['15% usage discount', '600 requests/min', '$150 credit included monthly', 'Priority support'],
  },
}

/** Rate limit for pay-as-you-go users with no monthly plan. */
export const FREE_RATE_LIMIT_PER_MIN = 20

/** Prepaid top-up options (Stripe payment-mode checkout). */
export const TOP_UP_OPTIONS = [10, 25, 100]

export function planFor(planId?: string | null): ApiPlan | null {
  if (!planId) return null
  return API_PLANS[planId] || null
}

export function discountFor(planId?: string | null): number {
  return planFor(planId)?.discount ?? 0
}

export function rateLimitFor(planId?: string | null): number {
  return planFor(planId)?.rateLimitPerMin ?? FREE_RATE_LIMIT_PER_MIN
}

/** Format micro-USD for display, e.g. 1234567 -> "$1.234567" trimmed to 4dp. */
export function formatMicros(micros: bigint | number): string {
  const n = Number(micros) / MICROS_PER_USD
  return `$${n.toFixed(n >= 1 ? 2 : 4)}`
}

export interface CostInput {
  kind: 'chat' | 'image' | 'video'
  tokensIn?: number
  tokensOut?: number
  cachedTokensIn?: number
  units?: number
  /** Chat model tier — selects the per-token rate. Defaults to `standard`. */
  tier?: string | null
}

/**
 * Compute the gross cost of a request in micro-USD, before any plan discount.
 */
export function grossCostMicros(input: CostInput): number {
  if (input.kind === 'image') return RATE_IMAGE * Math.max(1, input.units || 1)
  if (input.kind === 'video') return RATE_VIDEO * Math.max(1, input.units || 1)

  const rates = chatRatesFor(input.tier)
  const cached = Math.max(0, input.cachedTokensIn || 0)
  const fresh = Math.max(0, (input.tokensIn || 0) - cached)
  const out = Math.max(0, input.tokensOut || 0)

  const inputCost =
    (fresh * rates.input) / 1_000_000 +
    (cached * rates.input * CACHED_INPUT_DISCOUNT) / 1_000_000
  const outputCost = (out * rates.output) / 1_000_000
  return Math.ceil(inputCost + outputCost)
}

/** Apply the account's monthly-plan discount to a gross cost. */
export function netCostMicros(gross: number, planId?: string | null): number {
  const net = gross * (1 - discountFor(planId))
  return Math.max(0, Math.ceil(net))
}

export interface ApiAccount {
  balanceMicros: bigint
  plan: string | null
  planName: string | null
  discount: number
  rateLimitPerMin: number
  previewGranted: boolean
}

export async function getApiAccount(userId: string): Promise<ApiAccount | null> {
  if (!hasDb || !prisma) return null
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { apiBalanceMicros: true, apiPlan: true, apiPreviewGranted: true },
  })
  if (!user) return null
  return {
    balanceMicros: user.apiBalanceMicros,
    plan: user.apiPlan,
    planName: planFor(user.apiPlan)?.name ?? null,
    discount: discountFor(user.apiPlan),
    rateLimitPerMin: rateLimitFor(user.apiPlan),
    previewGranted: user.apiPreviewGranted,
  }
}

/** Credit a user's prepaid balance and record the ledger row. */
export async function addBalance(
  userId: string,
  amountMicros: number | bigint,
  source: string,
  reference?: string
): Promise<void> {
  if (!hasDb || !prisma) return
  const amount = BigInt(amountMicros)
  if (amount <= 0n) return
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { apiBalanceMicros: { increment: amount } },
    }),
    prisma.apiTopUp.create({ data: { userId, amountMicros: amount, source, reference } }),
  ])
}

/**
 * Grant the one-time free preview credit. Returns true when it was granted.
 */
export async function grantPreviewCredit(userId: string): Promise<boolean> {
  if (!hasDb || !prisma) return false
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { apiPreviewGranted: true } })
  if (!user || user.apiPreviewGranted) return false
  await prisma.user.update({ where: { id: userId }, data: { apiPreviewGranted: true } })
  await addBalance(userId, PREVIEW_CREDIT_MICROS, 'preview')
  return true
}

/**
 * Debit usage and write the ApiUsage row. Returns the charged amount.
 * Balance is allowed to go to zero but not negative — the caller checks funds
 * up front, and a small overshoot on the final chunk of a stream is absorbed.
 */
export async function chargeUsage(params: {
  userId: string
  apiKeyId?: string | null
  kind: 'chat' | 'image' | 'video'
  model?: string
  tokensIn?: number
  tokensOut?: number
  cachedTokensIn?: number
  units?: number
  planId?: string | null
  /** Chat model tier — selects the per-token rate. Defaults to `standard`. */
  tier?: string | null
}): Promise<number> {
  const gross = grossCostMicros(params)
  const net = netCostMicros(gross, params.planId)
  if (!hasDb || !prisma) return net

  await prisma.$transaction([
    prisma.user.update({
      where: { id: params.userId },
      data: { apiBalanceMicros: { decrement: BigInt(net) } },
    }),
    prisma.apiUsage.create({
      data: {
        userId: params.userId,
        apiKeyId: params.apiKeyId || null,
        kind: params.kind,
        model: params.model || '',
        tokensIn: Math.max(0, params.tokensIn || 0),
        tokensOut: Math.max(0, params.tokensOut || 0),
        units: Math.max(0, params.units || 0),
        costMicros: BigInt(net),
      },
    }),
  ])

  if (params.apiKeyId) {
    await prisma.apiKey
      .update({ where: { id: params.apiKeyId }, data: { lastUsedAt: new Date() } })
      .catch(() => {})
  }
  return net
}

/** Public pricing document served to the frontend and docs page. */
export function pricingConfig() {
  const catalog = chatModelCatalog()
  return {
    currency: 'USD',
    rates: {
      chatInputPerMillionTokens: RATE_CHAT_INPUT_PER_MTOK / MICROS_PER_USD,
      chatOutputPerMillionTokens: RATE_CHAT_OUTPUT_PER_MTOK / MICROS_PER_USD,
      cachedInputMultiplier: CACHED_INPUT_DISCOUNT,
      perImage: RATE_IMAGE / MICROS_PER_USD,
      perVideo: RATE_VIDEO / MICROS_PER_USD,
    },
    /** Per-model rate card. `chat*PerMillionTokens` above mirrors the standard tier. */
    models: catalog.map((m) => {
      const r = chatRatesFor(m.tier)
      return {
        id: m.id,
        tier: m.tier,
        label: m.label,
        description: m.description,
        contextTokens: m.contextTokens,
        inputPerMillionTokens: r.input / MICROS_PER_USD,
        outputPerMillionTokens: r.output / MICROS_PER_USD,
      }
    }),
    plans: Object.values(API_PLANS).map((p) => ({
      id: p.id,
      name: p.name,
      priceUsd: p.priceUsd,
      discountPercent: Math.round(p.discount * 100),
      rateLimitPerMin: p.rateLimitPerMin,
      includedCreditUsd: p.includedCreditMicros / MICROS_PER_USD,
      highlights: p.highlights,
    })),
    payAsYouGo: {
      rateLimitPerMin: FREE_RATE_LIMIT_PER_MIN,
      previewCreditUsd: PREVIEW_CREDIT_MICROS / MICROS_PER_USD,
    },
    topUps: TOP_UP_OPTIONS,
  }
}
