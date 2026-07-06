import { getOpenAIKey, getActiveProvider, getAwsCredentials } from './settings'
import { formatAnswersSummary } from './onboarding'
import { OPENAI_REPORT_MODEL } from './constants'

/**
 * Build a structured summary of all CV report scores for the LLM prompt
 */
function cvReportSummary(cvReport, metrics) {
  if (!cvReport) return 'No CV analysis data available.'
  const lines = []
  if (cvReport.overall) lines.push(`Overall Score: ${cvReport.overall.score}/100 (${cvReport.overall.scoreLabel})`)
  if (cvReport.faceShape) lines.push(`Face Shape: ${cvReport.faceShape.shape} (W/H ratio ${cvReport.faceShape.widthHeightRatio})`)
  if (cvReport.symmetry) lines.push(`Symmetry: ${cvReport.symmetry.score}/100 (${cvReport.symmetry.scoreLabel})`)
  if (cvReport.proportions) lines.push(`Proportions: ${cvReport.proportions.score}/100 (${cvReport.proportions.scoreLabel}) — Upper ${cvReport.proportions.upperThird}, Middle ${cvReport.proportions.middleThird}, Lower ${cvReport.proportions.lowerThird}`)
  if (cvReport.nose) lines.push(`Nose: ${cvReport.nose.score}/100 (${cvReport.nose.scoreLabel}) — ${cvReport.nose.width} width, ratio ${cvReport.nose.widthLengthRatio}`)
  if (cvReport.lips) lines.push(`Lips: ${cvReport.lips.score}/100 (${cvReport.lips.scoreLabel}) — ${cvReport.lips.fullness} fullness, philtrum ratio ${cvReport.lips.philtrumToLipRatio}`)
  if (cvReport.jawChin) lines.push(`Jaw & Chin: ${cvReport.jawChin.score}/100 (${cvReport.jawChin.scoreLabel}) — ${cvReport.jawChin.jawShape} jaw, ${cvReport.jawChin.chinType} chin`)
  if (cvReport.skin) lines.push(`Skin: ${cvReport.skin.score}/100 (${cvReport.skin.scoreLabel}) — tone: ${cvReport.skin.tone}, texture: ${cvReport.skin.texture}, clarity: ${cvReport.skin.clarity}, redness: ${cvReport.skin.redness || 'N/A'}`)
  if (cvReport.eyebrows?.metrics) {
    const b = cvReport.eyebrows.metrics
    lines.push(`Eyebrows: ${b.position} position, ${b.shape} shape, ${b.tilt} tilt`)
  }
  if (metrics) {
    lines.push(`Visual Age Estimate: ${metrics.visualAge}y`)
    lines.push(`Harmony Score: ${metrics.harmonyScore}/100`)
  }
  return lines.join('\n')
}

/**
 * Generate personalized protocol using the configured LLM provider.
 * Falls back to template recommendations if no provider is configured.
 */
export async function generateProtocol(cvReport, metrics, answers, imagePreview) {
  const provider = getActiveProvider()

  // ── OpenAI path ──
  if (provider === 'openai') {
    const apiKey = getOpenAIKey()
    if (!apiKey) return null

    try {
      const { goals, concerns, severity, ethnicity, skinType, skincareRoutine, occupation, smoking, age, gender } = formatAnswersSummary(answers)
      const cvSummary = cvReportSummary(cvReport, metrics)

      const messages = [
        {
          role: 'system',
          content: `You are an expert aesthetic analyst generating a personalized facial improvement protocol.

Given the client's CV analysis scores and profile, produce a structured JSON protocol with this exact schema:
{
  "summary": "1-2 sentence overview of the protocol",
  "recommendations": [
    {
      "title": "Short actionable title",
      "description": "2-3 sentence explanation with specific steps",
      "priority": "high" | "medium" | "low",
      "category": "skincare" | "lifestyle" | "exercise" | "grooming" | "nutrition"
    }
  ]
}

Rules:
- Generate 5-8 recommendations
- Prioritize based on their LOWEST scoring areas
- Reference their actual scores (e.g., "Your symmetry score of 72 suggests...")
- Include at least 1 skincare, 1 lifestyle, and 1 exercise recommendation
- Be specific and actionable, not generic
- Consider their age, gender, skin type, and goals
- Do NOT include surgical recommendations
- Return ONLY valid JSON, no markdown`,
        },
        {
          role: 'user',
          content: `Client Profile:
- Goals: ${goals}
- Skin concerns: ${concerns}
- Concern severity: ${severity}
- Ethnic heritage: ${ethnicity}
- Skin type: ${skinType}
- Skincare routine: ${skincareRoutine}
- Occupation/environment: ${occupation}
- Smoking: ${smoking}
- Age range: ${age}
- Gender: ${gender}

CV Analysis Scores:
${cvSummary}`,
        },
      ]

      // Attach face image for visual context
      if (imagePreview?.startsWith('data:image')) {
        messages[1] = {
          role: 'user',
          content: [
            { type: 'text', text: messages[1].content },
            { type: 'image_url', image_url: { url: imagePreview, detail: 'low' } },
          ],
        }
      }

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: OPENAI_REPORT_MODEL,
          messages,
          temperature: 0.6,
          max_tokens: 1200,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message || `OpenAI API error (${res.status})`)
      }

      const data = await res.json()
      const content = data.choices?.[0]?.message?.content
      if (!content) throw new Error('Empty response from OpenAI')

      // Parse JSON from response (handle markdown code blocks)
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(jsonStr)
      return { protocol: parsed, source: 'openai' }
    } catch (err) {
      console.warn('LLM protocol generation failed, falling back to template:', err.message)
      return null
    }
  }

  // ── Future: AWS / local / other providers ──
  // For now, return null to trigger template fallback
  return null
}

/**
 * Template-based protocol (fallback when no LLM is configured)
 */
export function getTemplateProtocol(cvReport) {
  const recommendations = []

  if (cvReport?.jawChin?.score < 80) {
    recommendations.push({
      title: 'Facial muscle exercises',
      description: 'Regular jawline exercises can help define the lower face. Try chin lifts, jaw releases, and neck stretches for 10 minutes daily. Focus on resistance movements to strengthen the masseter and platysma muscles.',
      priority: 'high',
      category: 'exercise',
    })
  }
  if (cvReport?.symmetry?.score < 80) {
    recommendations.push({
      title: 'Sleep position awareness',
      description: 'Sleeping on your back can help prevent facial asymmetry from developing due to gravitational pressure on one side. Use a silk pillowcase to reduce friction and consider a cervical pillow for support.',
      priority: 'medium',
      category: 'lifestyle',
    })
  }
  if (cvReport?.skin?.score < 85) {
    recommendations.push({
      title: 'Skincare routine optimization',
      description: 'A consistent routine with SPF 30+ daily, retinol at night, and adequate hydration can significantly improve skin quality. Start with a gentle cleanser, followed by vitamin C serum in the morning and retinol in the evening.',
      priority: 'high',
      category: 'skincare',
    })
  }
  if (cvReport?.skin?.redness && cvReport.skin.redness !== 'Normal') {
    recommendations.push({
      title: 'Anti-inflammatory skincare',
      description: 'Your analysis detected mild redness. Consider niacinamide (vitamin B3) serum to reduce inflammation, and avoid harsh exfoliants. Green tea-based products can also help soothe reactive skin.',
      priority: 'medium',
      category: 'skincare',
    })
  }
  if (cvReport?.nose?.score < 80) {
    recommendations.push({
      title: 'Makeup contouring techniques',
      description: 'Strategic contouring can enhance nasal proportions. Focus on highlighting the bridge and subtle shading on the sides. A matte bronzer 2 shades darker than your skin tone works best.',
      priority: 'low',
      category: 'grooming',
    })
  }
  if (cvReport?.lips?.score < 80) {
    recommendations.push({
      title: 'Lip care and hydration',
      description: 'Keep lips hydrated with a ceramide-based lip balm. Exfoliate gently 2x weekly with a sugar scrub. Avoid licking lips as it causes moisture loss. Consider a lip sleeping mask overnight.',
      priority: 'low',
      category: 'skincare',
    })
  }
  if (cvReport?.eyebrows?.metrics?.shape === 'Straight') {
    recommendations.push({
      title: 'Eyebrow shaping',
      description: 'Consider professional eyebrow shaping to add arch definition. A soft arch can open up the eye area and create a more balanced periorbital frame. Thread or wax rather than pluck for cleaner lines.',
      priority: 'low',
      category: 'grooming',
    })
  }

  // Always include these core recommendations
  recommendations.push(
    {
      title: 'Daily sunscreen application',
      description: 'Apply SPF 30+ broad-spectrum sunscreen every morning, reapplying every 2 hours when outdoors. UV protection is the single most effective anti-aging measure. Choose a lightweight, non-comedogenic formula.',
      priority: 'high',
      category: 'skincare',
    },
    {
      title: 'Hydration & nutrition',
      description: 'Drink at least 2L of water daily. Omega-3 fatty acids (from fish or supplements), vitamin C, and antioxidants support skin health from within. Reduce processed sugar intake which accelerates glycation and skin aging.',
      priority: 'medium',
      category: 'nutrition',
    },
    {
      title: 'Quality sleep',
      description: 'Aim for 7-9 hours of quality sleep. Sleep deprivation accelerates skin aging, increases cortisol, and worsens under-eye appearance. Maintain a consistent sleep schedule and limit screens 1 hour before bed.',
      priority: 'medium',
      category: 'lifestyle',
    }
  )

  return {
    summary: 'A personalized protocol based on your facial analysis scores, targeting your specific areas for improvement while maintaining your natural strengths.',
    recommendations,
  }
}
