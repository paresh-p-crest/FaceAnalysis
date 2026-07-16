export const PROTOCOL_ITEMS = [
  { id: 'glasses', label: 'Take off any glasses and hat' },
  { id: 'lighting', label: 'Use natural, even lighting on your face' },
  { id: 'background', label: 'Use a plain, neutral background' },
  { id: 'hair', label: 'Tie long hair back — face, neck and ears visible' },
  { id: 'makeup', label: 'Remove heavy makeup (light makeup OK)' },
  { id: 'clothing', label: 'Avoid neck-covering clothes (e.g. turtlenecks)' },
  { id: 'filters', label: "Don't use filters on the photo" },
]

export const PHOTO_POSES = [
  {
    id: 'front',
    label: 'Front Face',
    required: true,
    hint: 'Entire face head-on with a neutral expression',
  },
  {
    id: 'leftProfile',
    label: 'Left Profile',
    required: true,
    hint: 'Left side profile — full face from the left',
  },
  {
    id: 'rightProfile',
    label: 'Right Profile',
    required: true,
    hint: 'Right side profile — full face from the right',
  },
  {
    id: 'left45',
    label: 'Left 45°',
    required: true,
    hint: 'Three-quarter angle from the left',
  },
  {
    id: 'right45',
    label: 'Right 45°',
    required: true,
    hint: 'Three-quarter angle from the right',
  },
  {
    id: 'smile',
    label: 'Smile',
    required: true,
    hint: 'Smile naturally showing teeth — for smile shape & teeth analysis',
  },
  {
    id: 'topHead',
    label: 'Top of Head',
    required: true,
    hint: 'Tilt head down showing top of head and hairline — for hair density analysis',
  },
]

export const REQUIRED_PHOTO_POSE_IDS = PHOTO_POSES.filter((p) => p.required).map((p) => p.id)
