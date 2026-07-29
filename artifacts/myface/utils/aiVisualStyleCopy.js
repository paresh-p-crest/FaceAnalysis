/**
 * Static attr enums for AI visual style panels (no prose).
 * Titles/explanations live in messages AiVisuals.styles.* (keyed by styleId).
 */

const HAIR_COPY = {
  textured_crop: { maintenance: 'low', layers: 'light', parting: 'noPart', vibe: 'masculine' },
  side_part_classic: { maintenance: 'medium', layers: 'light', parting: 'side', vibe: 'polished' },
  slick_back: { maintenance: 'medium', layers: 'minimal', parting: 'noPart', vibe: 'masculine' },
  curtain_fringe: { maintenance: 'medium', layers: 'medium', parting: 'center', vibe: 'soft' },
  buzz_crew_cut: { maintenance: 'low', layers: 'minimal', parting: 'noPart', vibe: 'masculine' },
  textured_quiff: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'masculine' },
  undercut_volume_top: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'bold' },
  angular_fringe: { maintenance: 'medium', layers: 'light', parting: 'side', vibe: 'modern' },
  high_fade_pompadour: { maintenance: 'high', layers: 'medium', parting: 'noPart', vibe: 'bold' },
  side_part_height: { maintenance: 'medium', layers: 'light', parting: 'side', vibe: 'masculine' },
  textured_crop_soft_fringe: { maintenance: 'medium', layers: 'light', parting: 'noPart', vibe: 'soft' },
  side_swept_undercut: { maintenance: 'medium', layers: 'medium', parting: 'side', vibe: 'modern' },
  tousled_waves: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'soft' },
  layered_medium_length: { maintenance: 'medium', layers: 'heavy', parting: 'noPart', vibe: 'soft' },
  low_taper_soft_top: { maintenance: 'low', layers: 'light', parting: 'noPart', vibe: 'polished' },
  side_swept_medium_layers: { maintenance: 'medium', layers: 'medium', parting: 'side', vibe: 'balanced' },
  chin_length_textured_cut: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'balanced' },
  soft_curtain_fringe: { maintenance: 'medium', layers: 'light', parting: 'center', vibe: 'soft' },
  classic_taper_side_part: { maintenance: 'low', layers: 'light', parting: 'side', vibe: 'polished' },
  textured_forward_fringe: { maintenance: 'medium', layers: 'light', parting: 'noPart', vibe: 'modern' },
  textured_fringe_horizontal_volume: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'balanced' },
  side_part_with_width: { maintenance: 'medium', layers: 'light', parting: 'side', vibe: 'polished' },
  medium_wavy_layers: { maintenance: 'medium', layers: 'heavy', parting: 'noPart', vibe: 'soft' },
  low_fade_soft_textured_top: { maintenance: 'low', layers: 'light', parting: 'noPart', vibe: 'polished' },
  curtain_fringe_side_volume: { maintenance: 'medium', layers: 'medium', parting: 'center', vibe: 'soft' },
  layered_medium_texture: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'balanced' },
  soft_layered_bob: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'soft' },
  long_face_framing_layers: { maintenance: 'medium', layers: 'heavy', parting: 'noPart', vibe: 'soft' },
  soft_side_part_feminine: { maintenance: 'medium', layers: 'light', parting: 'side', vibe: 'polished' },
  curtain_bangs_medium: { maintenance: 'medium', layers: 'medium', parting: 'center', vibe: 'soft' },
  soft_updo_framing: { maintenance: 'high', layers: 'light', parting: 'noPart', vibe: 'polished' },
  crown_volume_long_layers: { maintenance: 'medium', layers: 'heavy', parting: 'noPart', vibe: 'soft' },
  soft_pixie_with_height: { maintenance: 'medium', layers: 'light', parting: 'noPart', vibe: 'modern' },
  long_layers_with_lift: { maintenance: 'medium', layers: 'heavy', parting: 'noPart', vibe: 'soft' },
  side_swept_bangs_height: { maintenance: 'medium', layers: 'light', parting: 'side', vibe: 'modern' },
  textured_lob_height: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'balanced' },
  soft_waves_jaw: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'soft' },
  rounded_bob: { maintenance: 'medium', layers: 'light', parting: 'noPart', vibe: 'soft' },
  face_framing_layers_soft: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'soft' },
  curtain_bangs_soft: { maintenance: 'medium', layers: 'light', parting: 'center', vibe: 'soft' },
  medium_layers_soft_corners: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'soft' },
  chin_length_soft_bob: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'balanced' },
  side_swept_layers_balance: { maintenance: 'medium', layers: 'medium', parting: 'side', vibe: 'balanced' },
  soft_curtain_bangs_heart: { maintenance: 'medium', layers: 'light', parting: 'center', vibe: 'soft' },
  shoulder_waves_balance: { maintenance: 'medium', layers: 'heavy', parting: 'noPart', vibe: 'soft' },
  textured_lob_jaw_balance: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'balanced' },
  soft_bangs_width: { maintenance: 'medium', layers: 'light', parting: 'noPart', vibe: 'soft' },
  wavy_shoulder_layers: { maintenance: 'medium', layers: 'heavy', parting: 'noPart', vibe: 'soft' },
  side_part_soft_width: { maintenance: 'medium', layers: 'light', parting: 'side', vibe: 'polished' },
  chin_bob_horizontal: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'balanced' },
  curtain_bangs_side_volume_soft: { maintenance: 'medium', layers: 'medium', parting: 'center', vibe: 'soft' },
  medium_soft_layers_fem: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'soft' },
  medium_soft_layers: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'balanced' },
  curtain_fringe_neutral: { maintenance: 'medium', layers: 'medium', parting: 'center', vibe: 'soft' },
  soft_textured_top: { maintenance: 'low', layers: 'light', parting: 'noPart', vibe: 'balanced' },
  balanced_side_part: { maintenance: 'medium', layers: 'light', parting: 'side', vibe: 'polished' },
  shoulder_soft_layers: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'balanced' },
  crown_lift_soft_layers: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'balanced' },
  textured_top_height: { maintenance: 'medium', layers: 'light', parting: 'noPart', vibe: 'modern' },
  long_layers_neutral_lift: { maintenance: 'medium', layers: 'heavy', parting: 'noPart', vibe: 'balanced' },
  side_swept_fringe_height: { maintenance: 'medium', layers: 'light', parting: 'side', vibe: 'modern' },
  lob_soft_height: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'balanced' },
  soft_waves_neutral: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'soft' },
  rounded_soft_bob: { maintenance: 'medium', layers: 'light', parting: 'noPart', vibe: 'soft' },
  face_framing_neutral_layers: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'balanced' },
  curtain_fringe_soft_neutral: { maintenance: 'medium', layers: 'light', parting: 'center', vibe: 'soft' },
  medium_layers_neutral: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'balanced' },
  chin_length_neutral: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'balanced' },
  side_swept_neutral_layers: { maintenance: 'medium', layers: 'medium', parting: 'side', vibe: 'balanced' },
  soft_curtain_neutral: { maintenance: 'medium', layers: 'light', parting: 'center', vibe: 'soft' },
  shoulder_waves_neutral: { maintenance: 'medium', layers: 'heavy', parting: 'noPart', vibe: 'soft' },
  textured_lob_neutral: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'balanced' },
  fringe_width_neutral: { maintenance: 'medium', layers: 'light', parting: 'noPart', vibe: 'soft' },
  wavy_shoulder_neutral: { maintenance: 'medium', layers: 'heavy', parting: 'noPart', vibe: 'soft' },
  side_part_width_neutral: { maintenance: 'medium', layers: 'light', parting: 'side', vibe: 'polished' },
  chin_bob_neutral: { maintenance: 'medium', layers: 'medium', parting: 'noPart', vibe: 'balanced' },
  curtain_side_volume_neutral: { maintenance: 'medium', layers: 'medium', parting: 'center', vibe: 'soft' },
}

const OUTFIT_COPY = {
  professional: { occasion: 'business', formality: 'formal', palette: 'neutral', vibe: 'polished' },
  smart_casual: { occasion: 'smartCasual', formality: 'smart', palette: 'mixed', vibe: 'refined' },
  casual_everyday: { occasion: 'everyday', formality: 'casual', palette: 'soft', vibe: 'approachable' },
  minimalist_monochrome: { occasion: 'minimal', formality: 'smart', palette: 'monochrome', vibe: 'clean' },
  textured_layered: { occasion: 'layered', formality: 'smart', palette: 'earth', vibe: 'textured' },
}

const HAIR_FALLBACK = {
  maintenance: 'medium',
  layers: 'light',
  parting: 'noPart',
  vibe: 'balanced',
}

const OUTFIT_FALLBACK = {
  occasion: 'everyday',
  formality: 'smart',
  palette: 'neutral',
  vibe: 'polished',
}

/**
 * @param {'hair'|'outfit'} type
 * @param {{ styleId?: string, title?: string }} variant
 * @returns {{ attrs: Record<string, string>, attrKeys: string[], styleId: string }}
 */
export function resolveStylePanelCopy(type, variant) {
  const styleId = String(variant?.styleId || '').trim()

  if (type === 'outfit') {
    const row = OUTFIT_COPY[styleId] || {}
    return {
      styleId,
      attrs: {
        occasion: row.occasion || OUTFIT_FALLBACK.occasion,
        formality: row.formality || OUTFIT_FALLBACK.formality,
        palette: row.palette || OUTFIT_FALLBACK.palette,
        vibe: row.vibe || OUTFIT_FALLBACK.vibe,
      },
      attrKeys: ['occasion', 'formality', 'palette', 'vibe'],
    }
  }

  const row = HAIR_COPY[styleId] || {}
  return {
    styleId,
    attrs: {
      maintenance: row.maintenance || HAIR_FALLBACK.maintenance,
      layers: row.layers || HAIR_FALLBACK.layers,
      parting: row.parting || HAIR_FALLBACK.parting,
      vibe: row.vibe || HAIR_FALLBACK.vibe,
    },
    attrKeys: ['maintenance', 'layers', 'parting', 'vibe'],
  }
}

/**
 * Localized title + explanation from next-intl (AiVisuals namespace).
 * @param {'hair'|'outfit'} type
 * @param {{ styleId?: string, title?: string }} variant
 * @param {(key: string, values?: object) => string} t
 * @param {string} locale
 * @returns {{ title: string, explanation: string }}
 */
export function resolveStyleDisplayCopy(type, variant, t, locale = 'en') {
  const styleId = String(variant?.styleId || '').trim()
  const storedTitle = String(variant?.title || '').trim()
  const titleKey = `styles.${type}.${styleId}.title`
  const explKey = `styles.${type}.${styleId}.explanation`
  const hasTitle = typeof t.has === 'function' ? t.has(titleKey) : false
  const hasExpl = typeof t.has === 'function' ? t.has(explKey) : false

  let title
  if (hasTitle) title = t(titleKey)
  else if (locale !== 'de' && storedTitle) title = storedTitle
  else title = t('styles.fallbackTitle')

  let explanation
  if (hasExpl) explanation = t(explKey)
  else explanation = t('styles.fallbackExplanation')

  return { title, explanation }
}
