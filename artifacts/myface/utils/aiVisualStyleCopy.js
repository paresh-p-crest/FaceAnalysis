/**
 * Static / semi-dynamic copy for AI visual style panels (no LLM).
 * Keys match backend visual_style_banks style_id values.
 */

const HAIR_COPY = {
  textured_crop: {
    maintenance: 'low',
    layers: 'light',
    parting: 'noPart',
    vibe: 'masculine',
    explanation:
      'A short textured crop adds controlled movement on top while clean tapered sides keep the silhouette sharp and easy to maintain.',
  },
  side_part_classic: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'side',
    vibe: 'polished',
    explanation:
      'A classic side part with balanced length and controlled volume gives a polished silhouette that suits most face proportions.',
  },
  slick_back: {
    maintenance: 'medium',
    layers: 'minimal',
    parting: 'noPart',
    vibe: 'masculine',
    explanation:
      'A sleek slick-back with disciplined side-to-top flow creates a clean, structured finish with a strong masculine read.',
  },
  curtain_fringe: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'center',
    vibe: 'soft',
    explanation:
      'A curtain fringe with soft separation gently frames the forehead and adds approachable movement without heavy bulk.',
  },
  buzz_crew_cut: {
    maintenance: 'low',
    layers: 'minimal',
    parting: 'noPart',
    vibe: 'masculine',
    explanation:
      'A short buzz or crew cut with tight edges is low-maintenance and keeps facial features clearly visible.',
  },
  textured_quiff: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'masculine',
    explanation:
      'A textured quiff with lift at the crown and tapered sides adds height and elongates rounder face shapes.',
  },
  undercut_volume_top: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'bold',
    explanation:
      'An undercut with volume on top elongates the face and sharpens the sides for a more structured silhouette.',
  },
  angular_fringe: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'side',
    vibe: 'modern',
    explanation:
      'An angular fringe creates stronger forehead lines while keeping the sides clean for a modern, intentional look.',
  },
  high_fade_pompadour: {
    maintenance: 'high',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'bold',
    explanation:
      'A high-fade pompadour with elevated front volume and a crisp taper adds vertical emphasis and polish.',
  },
  side_part_height: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'side',
    vibe: 'masculine',
    explanation:
      'A side part with extra height on top reduces roundness and improves perceived facial structure.',
  },
  textured_crop_soft_fringe: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'noPart',
    vibe: 'soft',
    explanation:
      'A textured crop with a soft fringe eases straight forehead lines while keeping the overall cut neat.',
  },
  side_swept_undercut: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'side',
    vibe: 'modern',
    explanation:
      'A side-swept undercut with blended texture keeps edges sharp without looking harsh on angular faces.',
  },
  tousled_waves: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'soft',
    explanation:
      'Light tousled waves with natural separation soften the jawline impression while keeping movement natural.',
  },
  layered_medium_length: {
    maintenance: 'medium',
    layers: 'heavy',
    parting: 'noPart',
    vibe: 'soft',
    explanation:
      'Medium length with layered movement blends corners and creates a softer overall shape around the jaw.',
  },
  low_taper_soft_top: {
    maintenance: 'low',
    layers: 'light',
    parting: 'noPart',
    vibe: 'polished',
    explanation:
      'A low taper with softer top texture keeps structure while reducing boxiness around the face.',
  },
  side_swept_medium_layers: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'side',
    vibe: 'balanced',
    explanation:
      'Side-swept medium layers create balanced weight around the mid-face and jaw for heart-shaped proportions.',
  },
  chin_length_textured_cut: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'balanced',
    explanation:
      'A chin-length textured cut adds controlled balance lower down without looking bulky at the temples.',
  },
  soft_curtain_fringe: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'center',
    vibe: 'soft',
    explanation:
      'A soft curtain fringe gently frames the forehead and reduces emphasis on a wider upper face.',
  },
  classic_taper_side_part: {
    maintenance: 'low',
    layers: 'light',
    parting: 'side',
    vibe: 'polished',
    explanation:
      'A classic taper with a side part keeps framing tidy and calms facial proportions.',
  },
  textured_forward_fringe: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'noPart',
    vibe: 'modern',
    explanation:
      'A textured forward fringe balances proportions visually while keeping the overall look natural.',
  },
  textured_fringe_horizontal_volume: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'balanced',
    explanation:
      'A textured fringe with horizontal volume visually reduces length and adds width for oblong faces.',
  },
  side_part_with_width: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'side',
    vibe: 'polished',
    explanation:
      'A side part with extra side width creates a more even face proportion on longer shapes.',
  },
  medium_wavy_layers: {
    maintenance: 'medium',
    layers: 'heavy',
    parting: 'noPart',
    vibe: 'soft',
    explanation:
      'Medium wavy layers add balanced texture and a wider-looking silhouette without excess height.',
  },
  low_fade_soft_textured_top: {
    maintenance: 'low',
    layers: 'light',
    parting: 'noPart',
    vibe: 'polished',
    explanation:
      'A low fade with a soft textured top stays neat while avoiding extra vertical height.',
  },
  curtain_fringe_side_volume: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'center',
    vibe: 'soft',
    explanation:
      'A curtain fringe with side volume adds width while keeping the top controlled.',
  },
  layered_medium_texture: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'balanced',
    explanation:
      'Medium textured layers add movement without making the style look overly sharp.',
  },
}

const OUTFIT_COPY = {
  professional: {
    occasion: 'business',
    formality: 'formal',
    palette: 'neutral',
    vibe: 'polished',
    explanation:
      'A tailored blazer or structured shirt reads polished and office-appropriate while keeping the portrait focus on your face.',
  },
  smart_casual: {
    occasion: 'smartCasual',
    formality: 'smart',
    palette: 'mixed',
    vibe: 'refined',
    explanation:
      'A knit or oxford with a light jacket feels refined but relaxed — ideal for everyday portrait polish.',
  },
  casual_everyday: {
    occasion: 'everyday',
    formality: 'casual',
    palette: 'soft',
    vibe: 'approachable',
    explanation:
      'A clean tee or casual shirt keeps the look approachable for weekend and everyday presentation.',
  },
  minimalist_monochrome: {
    occasion: 'minimal',
    formality: 'smart',
    palette: 'monochrome',
    vibe: 'clean',
    explanation:
      'Simple tonal layers in a restrained palette keep lines clean so facial features stay the focal point.',
  },
  textured_layered: {
    occasion: 'layered',
    formality: 'smart',
    palette: 'earth',
    vibe: 'textured',
    explanation:
      'A cardigan or light overshirt adds subtle depth and layering without competing with the face.',
  },
}

const HAIR_FALLBACK = {
  maintenance: 'medium',
  layers: 'light',
  parting: 'noPart',
  vibe: 'masculine',
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
 * @returns {{
 *   attrs: Record<string, string>,
 *   attrKeys: string[],
 *   explanation: string,
 * }}
 */
export function resolveStylePanelCopy(type, variant) {
  const styleId = String(variant?.styleId || '').trim()
  const title = String(variant?.title || '').trim()

  if (type === 'outfit') {
    const row = OUTFIT_COPY[styleId] || {}
    const attrs = {
      occasion: row.occasion || OUTFIT_FALLBACK.occasion,
      formality: row.formality || OUTFIT_FALLBACK.formality,
      palette: row.palette || OUTFIT_FALLBACK.palette,
      vibe: row.vibe || OUTFIT_FALLBACK.vibe,
    }
    return {
      attrs,
      attrKeys: ['occasion', 'formality', 'palette', 'vibe'],
      explanation:
        row.explanation ||
        (title
          ? `${title} is a shoulder-up styling concept chosen for a polished portrait presentation.`
          : 'A shoulder-up styling concept chosen for a polished portrait presentation.'),
    }
  }

  const row = HAIR_COPY[styleId] || {}
  const attrs = {
    maintenance: row.maintenance || HAIR_FALLBACK.maintenance,
    layers: row.layers || HAIR_FALLBACK.layers,
    parting: row.parting || HAIR_FALLBACK.parting,
    vibe: row.vibe || HAIR_FALLBACK.vibe,
  }
  return {
    attrs,
    attrKeys: ['maintenance', 'layers', 'parting', 'vibe'],
    explanation:
      row.explanation ||
      (title
        ? `${title} is selected to balance face shape, hairline, and overall facial harmony.`
        : 'This style is selected to balance face shape, hairline, and overall facial harmony.'),
  }
}
