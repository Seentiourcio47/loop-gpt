/**
 * generate_video tool: text-to-video and image-to-video generation.
 *
 * Uses HuggingFace Inference Endpoints for video generation (SkyReels-V2,
 * Stable Video Diffusion, or similar). Supports both text prompts and
 * image+prompt for video generation with reference.
 */
import { saveArtifact } from '../artifacts'
import { fetchBuffer, postJson } from '../httpClient'
import { checkCredits } from '../../services/billing'
import type { ToolDefinition } from '../types'

interface VideoGenerationResult {
  video_base64?: string
  video_url?: string
  model?: string
  duration?: number
  frames?: number
}

async function generateVideoFromEndpoint(
  prompt: string,
  imageBase64?: string,
  numFrames = 97,
  fps = 24,
  width = 960,
  height = 544
): Promise<Buffer> {
  const endpointUrl = process.env.VIDEO_API_URL || process.env.HF_VIDEO_ENDPOINT_URL
  if (!endpointUrl) {
    throw new Error('No video endpoint configured')
  }

  const payload: any = {
    inputs: prompt,
    parameters: {
      num_frames: numFrames,
      fps: fps,
      width: width,
      height: height,
    },
  }

  // If image is provided, use img2vid mode
  if (imageBase64) {
    payload.image = imageBase64
    payload.parameters.guidance_scale = 7.5
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 300000) // 5 min for video

  try {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN || ''}`,
        'Content-Type': 'application/json',
        Accept: 'video/mp4',
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${errorText.slice(0, 300)}`)
    }

    const contentType = res.headers.get('content-type') || ''

    // Handle job-based response (async video generation)
    if (contentType.includes('application/json')) {
      const jobData: any = await res.json()
      
      if (jobData.job_id && jobData.status_url) {
        // Poll for completion
        return await pollVideoJob(endpointUrl, jobData.job_id, jobData.status_url, jobData.result_url)
      }
      
      // Handle direct base64 response
      const b64 = jobData?.video || jobData?.data?.[0]?.b64_json || jobData?.images?.[0]?.b64_json
      if (b64) {
        return Buffer.from(b64, 'base64')
      }
      
      // Handle URL response
      const url = jobData?.url || jobData?.data?.[0]?.url
      if (url) {
        return fetchBuffer(url, { timeoutMs: 120000 })
      }
      
      throw new Error('Video endpoint returned unexpected JSON format')
    }

    // Direct video bytes response
    return Buffer.from(await res.arrayBuffer())
  } finally {
    clearTimeout(timer)
  }
}

async function pollVideoJob(
  baseUrl: string,
  jobId: string,
  statusUrl: string,
  resultUrl: string,
  maxWaitMs = 300000
): Promise<Buffer> {
  const startTime = Date.now()
  const pollInterval = 3000 // 3 seconds

  while (Date.now() - startTime < maxWaitMs) {
    const statusRes = await fetch(`${baseUrl}${statusUrl}`, {
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN || ''}`,
      },
    })

    if (!statusRes.ok) {
      throw new Error(`Status check failed: ${statusRes.status}`)
    }

    const status: any = await statusRes.json()
    
    if (status.status === 'completed') {
      // Fetch the actual video
      const videoRes = await fetch(`${baseUrl}${resultUrl}`, {
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN || ''}`,
          Accept: 'video/mp4',
        },
      })

      if (!videoRes.ok) {
        throw new Error(`Failed to fetch video: ${videoRes.status}`)
      }

      return Buffer.from(await videoRes.arrayBuffer())
    }

    if (status.status === 'failed') {
      throw new Error(`Video generation failed: ${status.error || status.message}`)
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }

  throw new Error('Video generation timed out')
}

export const generateVideoTool: ToolDefinition = {
  name: 'generate_video',
  source: 'builtin',
  description: 'Generate a short video clip from a text prompt or image+prompt. Use for creating cinematic scenes, animations, or motion graphics. Videos are typically 4-8 seconds at 24fps.',
  parameters: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'A detailed description of the video to generate. Include motion, style, lighting, and atmosphere. Example: "A serene mountain lake at sunrise with mist rising from the water, cinematic lighting, slow camera pan"',
      },
      image_prompt: {
        type: 'string',
        description: 'Optional base64-encoded image to use as a reference for img2video generation. Use this when the user wants to animate or add motion to an existing image.',
      },
      duration_seconds: {
        type: 'number',
        description: 'Desired video duration in seconds (2-10). Default: 4 seconds.',
        default: 4,
      },
      fps: {
        type: 'number',
        description: 'Frames per second (12-30). Higher = smoother but larger file. Default: 24.',
        default: 24,
      },
      aspect_ratio: {
        type: 'string',
        enum: ['landscape', 'portrait', 'square', 'wide'],
        description: 'Video aspect ratio. Default: landscape (16:9).',
        default: 'landscape',
      },
    },
    required: ['prompt'],
  },
  async handler(args, ctx) {
    const prompt = String(args.prompt || '').trim()
    if (!prompt) {
      return { content: 'Error: prompt is required for video generation.', isError: true }
    }

    // Credit check
    if (ctx.userId) {
      try {
        const credit = await checkCredits(ctx.userId, 'video')
        if (!credit.ok) {
          return { content: credit.reason || 'Out of video credits for today.', isError: true }
        }
      } catch {
        // metering unavailable — allow
      }
    }

    const duration = Number(args.duration_seconds) || 4
    const fps = Number(args.fps) || 24
    const numFrames = Math.min(Math.round(duration * fps), 120) // cap at 120 frames

    const aspectRatio = String(args.aspect_ratio || 'landscape')
    const SIZES: Record<string, [number, number]> = {
      landscape: [960, 544],
      portrait: [544, 960],
      square: [768, 768],
      wide: [1280, 720],
    }
    const [width, height] = SIZES[aspectRatio] || SIZES.landscape

    const imagePrompt = args.image_prompt ? String(args.image_prompt) : undefined

    ctx.emit({ 
      type: 'status', 
      message: `Generating ${duration}s video at ${fps}fps (${width}x${height})...` 
    })

    let buffer: Buffer | null = null
    let usedModel = 'skyreels-v2'

    try {
      buffer = await generateVideoFromEndpoint(
        prompt,
        imagePrompt,
        numFrames,
        fps,
        width,
        height
      )
    } catch (error: any) {
      ctx.emit({ type: 'status', message: `Video generation failed: ${error?.message || error}` })
      return { 
        content: `Video generation failed: ${error?.message || error}. Try a shorter duration or simpler prompt.`, 
        isError: true 
      }
    }

    if (!buffer || buffer.length === 0) {
      return { content: 'Video generation returned empty result.', isError: true }
    }

    // Save as artifact
    const safePrompt = prompt.slice(0, 40).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
    const artifact = saveArtifact(`video-${safePrompt}.mp4`, buffer)
    
    ctx.scratch.artifacts = ctx.scratch.artifacts || []
    ctx.scratch.artifacts.push(artifact)
    ctx.emit({ type: 'artifact', artifact })

    return {
      content: `Generated a ${duration}-second video (${fps}fps, ${width}x${height}) for "${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}". Video is ready to view.`,
      data: { 
        artifact,
        duration,
        fps,
        frames: numFrames,
        model: usedModel,
      },
    }
  },
}