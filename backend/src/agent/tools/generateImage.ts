/**
 * generate_image tool: text-to-image and img2img generation.
 *
 * Primary path uses HuggingFace Inference Providers with FLUX.1-dev.
 * Supports img2img mode for face cloning and style transfer when reference image is provided.
 */
import { saveArtifact } from '../artifacts'
import { imageApiService } from '../../services/imageApi'
import { fetchBuffer, postJson } from '../httpClient'
import { checkCredits } from '../../services/billing'
import type { ToolDefinition } from '../types'

/**
 * Generate via a dedicated HuggingFace Inference Endpoint supporting img2img.
 */
async function hfImageEndpoint(
  prompt: string,
  imageBase64?: string,
  strength = 0.75
): Promise<Buffer> {
  const raw = (process.env.HF_IMAGE_ENDPOINT_URL || '').replace(/\/+$/, '')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 180000)
  
  try {
    const payload: any = {
      inputs: prompt,
      parameters: {
        num_inference_steps: 28,
        guidance_scale: 3.5,
      },
    }
    
    if (imageBase64) {
      payload.image = imageBase64
      payload.parameters.strength = strength
    }
    
    const res = await fetch(raw, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN || ''}`,
        'Content-Type': 'application/json',
        Accept: 'image/png',
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    })
    
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const ct = res.headers.get('content-type') || ''
    
    if (ct.includes('application/json')) {
      const j: any = await res.json()
      const b64 = j?.image || j?.[0]?.image || j?.images?.[0]?.b64_json || j?.data?.[0]?.b64_json
      if (b64) return Buffer.from(b64, 'base64')
      const url = j?.url || j?.[0]?.url || j?.images?.[0]?.url || j?.data?.[0]?.url
      if (url) return fetchBuffer(url, { timeoutMs: 60000 })
      throw new Error('endpoint returned JSON without an image')
    }
    return Buffer.from(await res.arrayBuffer())
  } finally {
    clearTimeout(timer)
  }
}

function inferenceParams(model: string, width = 1024, height = 1024, imageBase64?: string, strength = 0.75) {
  const isSchnell = model.toLowerCase().includes('schnell')
  const params: any = {
    num_inference_steps: isSchnell ? 4 : 28,
    guidance_scale: isSchnell ? 0 : 3.5,
    width,
    height,
  }
  if (imageBase64) {
    params.image = imageBase64
    params.strength = strength
  }
  return params
}

async function hfTextToImage(
  prompt: string,
  model: string,
  width = 1024,
  height = 1024,
  imageBase64?: string,
  strength = 0.75
): Promise<Buffer> {
  const configured = process.env.HF_IMAGE_PROVIDER
  const providers = configured ? [configured] : ['fal-ai', 'together', 'nscale']
  const auth = { Authorization: `Bearer ${process.env.HF_TOKEN || ''}` }
  const params = inferenceParams(model, width, height, imageBase64, strength)
  let lastErr = ''

  for (const provider of providers) {
    try {
      const payload: any = { model, prompt, response_format: 'b64_json', ...params }
      if (imageBase64) {
        payload.image = imageBase64
        payload.strength = strength
      }
      const data = await postJson<any>(
        `https://router.huggingface.co/${provider}/v1/images/generations`,
        payload,
        { headers: auth, timeoutMs: 120000 }
      )
      const item = data?.data?.[0] || data?.images?.[0]
      if (item?.b64_json) return Buffer.from(item.b64_json, 'base64')
      if (item?.url) return fetchBuffer(item.url, { timeoutMs: 60000 })
      lastErr = `provider ${provider} returned no image`
    } catch (e: any) {
      lastErr = `${provider}: ${e?.message || e}`
    }
  }
  throw new Error(lastErr || 'no image provider succeeded')
}

export const generateImageTool: ToolDefinition = {
  name: 'generate_image',
  source: 'builtin',
  description: 'Generate images from text prompts using FLUX.1-dev. Supports img2img for face cloning when reference image provided.',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Detailed description of the image to generate.' },
      image_prompt: { type: 'string', description: 'Optional base64 reference image for img2img (face cloning/style transfer).' },
      aspect_ratio: {
        type: 'string',
        enum: ['square', 'landscape', 'portrait', 'wide'],
        description: 'Aspect ratio. Default: square.',
      },
      strength: {
        type: 'number',
        description: 'For img2img: transformation strength (0.0-1.0). Default: 0.75.',
        default: 0.75,
      },
    },
    required: ['prompt'],
  },
  async handler(args, ctx) {
    const prompt = String(args.prompt || '').trim()
    const imagePrompt = args.image_prompt ? String(args.image_prompt) : undefined
    const strength = Number(args.strength) || 0.75
    
    if (!prompt) return { content: 'Error: prompt is required.', isError: true }

    if (ctx.userId) {
      try {
        const credit = await checkCredits(ctx.userId, 'image')
        if (!credit.ok) return { content: credit.reason || 'Out of credits.', isError: true }
      } catch {}
    }

    const model = process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-dev'
    const ratio = String(args.aspect_ratio || 'square')
    const SIZES: Record<string, [number, number]> = {
      square: [1024, 1024],
      landscape: [1344, 768],
      portrait: [768, 1344],
      wide: [1536, 640],
    }
    const [imgW, imgH] = SIZES[ratio] || SIZES.square
    const mode = imagePrompt ? 'img2img' : 'text2img'

    ctx.emit({ type: 'status', message: `Generating image (${mode} mode)...` })

    let buffer: Buffer | null = null
    let usedModel = model
    
    if (process.env.HF_IMAGE_ENDPOINT_URL) {
      try {
        buffer = await hfImageEndpoint(prompt, imagePrompt, strength)
        usedModel = 'custom endpoint'
      } catch (e: any) {
        ctx.emit({ type: 'status', message: `Endpoint failed, trying providers...` })
      }
    }
    
    if (!buffer && process.env.HF_TOKEN) {
      try {
        buffer = await hfTextToImage(prompt, model, imgW, imgH, imagePrompt, strength)
      } catch (e: any) {
        ctx.emit({ type: 'status', message: `HF providers failed, trying fallback...` })
      }
    }

    if (!buffer && process.env.IMAGE_API_URL) {
      try {
        const result = await imageApiService.generateImage({ 
          prompt, image_prompt: imagePrompt, strength,
          model: 'flux-dev', return_base64: true 
        })
        if (result.image_base64) {
          buffer = Buffer.from(result.image_base64, 'base64')
          usedModel = result.model
        }
      } catch (e: any) {
        return { content: `Image generation failed: ${e?.message}`, isError: true }
      }
    }

    if (!buffer) {
      return { content: 'Image generation not configured.', isError: true }
    }

    const artifact = saveArtifact(`${prompt.slice(0, 30).replace(/\s+/g, '-')}.png`, buffer)
    ctx.scratch.artifacts = ctx.scratch.artifacts || []
    ctx.scratch.artifacts.push(artifact)
    ctx.emit({ type: 'artifact', artifact })
    
    return {
      content: `Generated image (${mode} mode) for "${prompt.slice(0, 80)}...".`,
      data: { artifact, mode },
    }
  },
}