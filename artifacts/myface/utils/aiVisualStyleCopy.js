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
  // Feminine preference bank
  soft_layered_bob: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'soft',
    explanation:
      'A soft layered bob with gentle movement flatters balanced proportions while keeping ends clean.',
  },
  long_face_framing_layers: {
    maintenance: 'medium',
    layers: 'heavy',
    parting: 'noPart',
    vibe: 'soft',
    explanation:
      'Long face-framing layers skim the cheeks and jaw for a softer, feminine silhouette.',
  },
  soft_side_part_feminine: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'side',
    vibe: 'polished',
    explanation:
      'A soft side part with polished mid-length volume gives a refined feminine read.',
  },
  curtain_bangs_medium: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'center',
    vibe: 'soft',
    explanation:
      'Medium length with soft curtain bangs gently frames the forehead without heavy bulk.',
  },
  soft_updo_framing: {
    maintenance: 'high',
    layers: 'light',
    parting: 'noPart',
    vibe: 'polished',
    explanation:
      'A soft loosely gathered updo with face-framing pieces keeps the look elegant and approachable.',
  },
  crown_volume_long_layers: {
    maintenance: 'medium',
    layers: 'heavy',
    parting: 'noPart',
    vibe: 'soft',
    explanation:
      'Long layers with crown lift add height and elongate rounder face shapes.',
  },
  soft_pixie_with_height: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'noPart',
    vibe: 'modern',
    explanation:
      'A soft pixie with textured crown height elongates the face while staying feminine.',
  },
  long_layers_with_lift: {
    maintenance: 'medium',
    layers: 'heavy',
    parting: 'noPart',
    vibe: 'soft',
    explanation:
      'Long layered hair with crown lift and tapered ends reduces roundness softly.',
  },
  side_swept_bangs_height: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'side',
    vibe: 'modern',
    explanation:
      'Side-swept bangs with top volume create vertical emphasis on rounder faces.',
  },
  textured_lob_height: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'balanced',
    explanation:
      'A textured lob with subtle crown lift gives a taller face read without harsh lines.',
  },
  soft_waves_jaw: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'soft',
    explanation:
      'Soft waves around the jaw ease angular corners for a gentler square-face silhouette.',
  },
  rounded_bob: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'noPart',
    vibe: 'soft',
    explanation:
      'A rounded bob with curved ends softens a strong jawline while staying polished.',
  },
  face_framing_layers_soft: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'soft',
    explanation:
      'Face-framing soft layers blend corners and create a gentler overall outline.',
  },
  curtain_bangs_soft: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'center',
    vibe: 'soft',
    explanation:
      'Soft curtain bangs with medium length ease forehead lines and soften angles.',
  },
  medium_layers_soft_corners: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'soft',
    explanation:
      'Medium layered hair with soft ends reduces boxiness around the face.',
  },
  chin_length_soft_bob: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'balanced',
    explanation:
      'A chin-length soft bob adds lower-face balance without temple bulk.',
  },
  side_swept_layers_balance: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'side',
    vibe: 'balanced',
    explanation:
      'Side-swept medium layers balance mid-face width and frame the jaw gently.',
  },
  soft_curtain_bangs_heart: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'center',
    vibe: 'soft',
    explanation:
      'Soft curtain bangs reduce forehead emphasis while keeping a feminine frame.',
  },
  shoulder_waves_balance: {
    maintenance: 'medium',
    layers: 'heavy',
    parting: 'noPart',
    vibe: 'soft',
    explanation:
      'Shoulder-length soft waves add lower-face balance and gentle width.',
  },
  textured_lob_jaw_balance: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'balanced',
    explanation:
      'A textured lob with soft ends visually balances a narrower jaw.',
  },
  soft_bangs_width: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'noPart',
    vibe: 'soft',
    explanation:
      'Soft bangs with side volume visually shorten length and add width for oblong faces.',
  },
  wavy_shoulder_layers: {
    maintenance: 'medium',
    layers: 'heavy',
    parting: 'noPart',
    vibe: 'soft',
    explanation:
      'Wavy shoulder-length layers add horizontal volume without extra height.',
  },
  side_part_soft_width: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'side',
    vibe: 'polished',
    explanation:
      'A soft side part with fuller sides creates a more even face proportion.',
  },
  chin_bob_horizontal: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'balanced',
    explanation:
      'A chin-length bob with soft horizontal volume reduces a long silhouette.',
  },
  curtain_bangs_side_volume_soft: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'center',
    vibe: 'soft',
    explanation:
      'Curtain bangs with soft side volume add width while keeping the top controlled.',
  },
  medium_soft_layers_fem: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'soft',
    explanation:
      'Medium soft layers with natural movement keep a gentle feminine silhouette.',
  },
  // No-preference / unisex bank
  medium_soft_layers: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'balanced',
    explanation:
      'Medium soft layers with natural movement create a balanced, unisex silhouette.',
  },
  curtain_fringe_neutral: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'center',
    vibe: 'soft',
    explanation:
      'A curtain fringe with soft separation gently frames the forehead for most face shapes.',
  },
  soft_textured_top: {
    maintenance: 'low',
    layers: 'light',
    parting: 'noPart',
    vibe: 'balanced',
    explanation:
      'A soft textured top with clean tapered sides stays neat without a heavy barbershop read.',
  },
  balanced_side_part: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'side',
    vibe: 'polished',
    explanation:
      'A balanced side part with controlled mid-length volume suits a polished neutral look.',
  },
  shoulder_soft_layers: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'balanced',
    explanation:
      'Shoulder-length soft layers with easy movement and gender-neutral framing.',
  },
  crown_lift_soft_layers: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'balanced',
    explanation:
      'Soft layers with crown lift add height without a strongly gendered cut.',
  },
  textured_top_height: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'noPart',
    vibe: 'modern',
    explanation:
      'A textured top with crown lift and softly tapered sides elongates rounder faces.',
  },
  long_layers_neutral_lift: {
    maintenance: 'medium',
    layers: 'heavy',
    parting: 'noPart',
    vibe: 'balanced',
    explanation:
      'Long layers with subtle crown lift elongate a rounder face in a neutral style.',
  },
  side_swept_fringe_height: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'side',
    vibe: 'modern',
    explanation:
      'A side-swept fringe with top volume creates vertical emphasis.',
  },
  lob_soft_height: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'balanced',
    explanation:
      'A soft lob with slight crown lift and clean ends for a taller face read.',
  },
  soft_waves_neutral: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'soft',
    explanation:
      'Soft waves with natural separation ease angular lines around the jaw.',
  },
  rounded_soft_bob: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'noPart',
    vibe: 'soft',
    explanation:
      'A rounded soft bob with curved ends softens a strong jawline.',
  },
  face_framing_neutral_layers: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'balanced',
    explanation:
      'Face-framing layers blend corners into a softer overall shape.',
  },
  curtain_fringe_soft_neutral: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'center',
    vibe: 'soft',
    explanation:
      'A soft curtain fringe with medium length eases forehead lines.',
  },
  medium_layers_neutral: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'balanced',
    explanation:
      'Medium soft layers reduce boxiness while staying unisex.',
  },
  chin_length_neutral: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'balanced',
    explanation:
      'A chin-length soft cut adds balance lower down without temple bulk.',
  },
  side_swept_neutral_layers: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'side',
    vibe: 'balanced',
    explanation:
      'Side-swept medium layers balance mid-face width and frame the jaw.',
  },
  soft_curtain_neutral: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'center',
    vibe: 'soft',
    explanation:
      'A soft curtain fringe gently reduces forehead emphasis.',
  },
  shoulder_waves_neutral: {
    maintenance: 'medium',
    layers: 'heavy',
    parting: 'noPart',
    vibe: 'soft',
    explanation:
      'Shoulder-length soft waves add lower-face balance.',
  },
  textured_lob_neutral: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'balanced',
    explanation:
      'A textured soft lob with ends that visually balance a narrower jaw.',
  },
  fringe_width_neutral: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'noPart',
    vibe: 'soft',
    explanation:
      'A soft fringe with side volume visually shortens length and adds width.',
  },
  wavy_shoulder_neutral: {
    maintenance: 'medium',
    layers: 'heavy',
    parting: 'noPart',
    vibe: 'soft',
    explanation:
      'Wavy shoulder layers add horizontal volume without extra height.',
  },
  side_part_width_neutral: {
    maintenance: 'medium',
    layers: 'light',
    parting: 'side',
    vibe: 'polished',
    explanation:
      'A side part with fuller sides creates a more even face proportion.',
  },
  chin_bob_neutral: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'noPart',
    vibe: 'balanced',
    explanation:
      'A chin-length soft bob with horizontal volume reduces a long silhouette.',
  },
  curtain_side_volume_neutral: {
    maintenance: 'medium',
    layers: 'medium',
    parting: 'center',
    vibe: 'soft',
    explanation:
      'A curtain fringe with soft side volume keeps the top controlled.',
  },
}

const OUTFIT_COPY = {
  professional: {
    occasion: 'business',
    formality: 'formal',
    palette: 'neutral',
    vibe: 'polished',
    explanation:
      'A tailored blazer or structured top reads polished and office-appropriate while keeping the portrait focus on your face.',
  },
  smart_casual: {
    occasion: 'smartCasual',
    formality: 'smart',
    palette: 'mixed',
    vibe: 'refined',
    explanation:
      'A soft knit or neat shirt with a light jacket feels refined but relaxed — ideal for everyday portrait polish.',
  },
  casual_everyday: {
    occasion: 'everyday',
    formality: 'casual',
    palette: 'soft',
    vibe: 'approachable',
    explanation:
      'A clean tee or simple top keeps the look approachable for weekend and everyday presentation.',
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
      'A cardigan or light layering piece adds subtle depth without competing with the face.',
  },
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
