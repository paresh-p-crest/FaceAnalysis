import { buildMockReport } from './mockReport'
import { buildAwsReport } from './buildAwsReport'
import { getOpenAIKey, getActiveLLM } from './settings'
import { isDemoMode } from './appMode'
import { formatAnswersSummary } from './onboarding'

function metricsBlock(metrics) {
  if (!metrics) return ''
  return `Real CV measurements (${metrics.source}):
- Symmetry: ${metrics.symmetry}%
- Harmony: ${metrics.harmonyScore}/100
- Proportionality: ${metrics.proportionality}%
- Visual age estimate: ${metrics.visualAge}
- Facial thirds (U/M/L): ${metrics.upperThird}/${metrics.middleThird}/${metrics.lowerThird}
- Jawline angle: ${metrics.jawlineAngle}°
${metrics.pose ? `- Pose: ${metrics.pose}` : ''}
${metrics.quality ? `- Quality: ${metrics.quality}` : ''}
Use these real measured values in the report.`
}

export async function generateReport(answers, imagePreview, cvMetrics = null, cvError = null, faceDetails = null, protocolWarnings = []) {
  if (isDemoMode()) {
    return { content: buildMockReport(answers, cvMetrics), source: 'mock', error: null }
  }

  if (cvError) {
    return { content: null, source: null, error: `Analysis failed: ${cvError}` }
  }

  if (!cvMetrics) {
    return { content: null, source: null, error: 'No analysis data available. Check credentials in Settings.' }
  }

  const activeLLM = getActiveLLM()

  if (activeLLM === 'aws') {
    const content = buildAwsReport(faceDetails, cvMetrics, answers, protocolWarnings)
    if (!content) {
      return { content: null, source: null, error: 'AWS data missing — analysis may have failed.' }
    }
    return { content, source: 'aws', error: null }
  }

  const apiKey = getOpenAIKey()
  if (!apiKey) {
    return { content: null, source: null, error: 'OpenAI API key not set. Open Settings → OpenAI tab.' }
  }

  try {
    const { goals, concerns, severity, occupation, smoking, medicalConditions, age, gender } = formatAnswersSummary(answers)
    const messages = [
      {
        role: 'system',
        content: `You are an expert aesthetic analyst writing a professional facial analysis report. 
Write in clean Markdown with sections: Executive Summary, Structural Analysis (proportions, symmetry, jawline, eyes, nose), 
Skin Quality, Top Strengths (3), Improvement Areas (3), Personalized 30-Day Protocol.
Be specific, clinical yet accessible. Reference their questionnaire answers. Keep it 600-900 words.
Do NOT use golden ratio mythology. Focus on proportionality, symmetry, and evidence-based non-surgical recommendations.`,
      },
      {
        role: 'user',
        content: `Generate a facial analysis report for a client with these profile details:
- Goals: ${goals}
- Skin concerns: ${concerns}
- Concern severity: ${severity}
- Occupation: ${occupation}
- Smoking: ${smoking}
- Medical conditions: ${medicalConditions}
- Age range: ${age}
- Gender: ${gender}

${metricsBlock(cvMetrics)}`,
      },
    ]

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
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 1500,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message || `OpenAI API error (${res.status})`)
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('Empty response from OpenAI')

    return { content, source: 'openai', error: null }
  } catch (err) {
    return { content: null, source: null, error: err.message || 'OpenAI report generation failed.' }
  }
}
