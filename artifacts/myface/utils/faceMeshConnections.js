/** MediaPipe Face Mesh feature edge sets (from face_mesh_connections.py). */

export const FACEMESH_LIPS = [
  [0, 267], [13, 312], [14, 317], [17, 314], [37, 0], [39, 37], [40, 39], [61, 146],
  [61, 185], [78, 95], [78, 191], [80, 81], [81, 82], [82, 13], [84, 17], [87, 14],
  [88, 178], [91, 181], [95, 88], [146, 91], [178, 87], [181, 84], [185, 40], [191, 80],
  [267, 269], [269, 270], [270, 409], [310, 415], [311, 310], [312, 311], [314, 405], [317, 402],
  [318, 324], [321, 375], [324, 308], [375, 291], [402, 318], [405, 321], [409, 291], [415, 308],
]

export const FACEMESH_LEFT_EYE = [
  [249, 390], [263, 249], [263, 466], [373, 374], [374, 380], [380, 381], [381, 382], [382, 362],
  [384, 398], [385, 384], [386, 385], [387, 386], [388, 387], [390, 373], [398, 362], [466, 388],
]

export const FACEMESH_LEFT_EYEBROW = [
  [276, 283], [282, 295], [283, 282], [293, 334], [295, 285], [296, 336], [300, 293], [334, 296],
]

export const FACEMESH_RIGHT_EYE = [
  [7, 163], [33, 7], [33, 246], [144, 145], [145, 153], [153, 154], [154, 155], [155, 133],
  [157, 173], [158, 157], [159, 158], [160, 159], [161, 160], [163, 144], [173, 133], [246, 161],
]

export const FACEMESH_RIGHT_EYEBROW = [
  [46, 53], [52, 65], [53, 52], [63, 105], [65, 55], [66, 107], [70, 63], [105, 66],
]

export const FACEMESH_FACE_OVAL = [
  [10, 338], [21, 54], [54, 103], [58, 132], [67, 109], [93, 234], [103, 67], [109, 10],
  [127, 162], [132, 93], [136, 172], [148, 176], [149, 150], [150, 136], [152, 148], [162, 21],
  [172, 58], [176, 149], [234, 127], [251, 389], [284, 251], [288, 397], [297, 332], [323, 361],
  [332, 284], [338, 297], [356, 454], [361, 288], [365, 379], [377, 152], [378, 400], [379, 378],
  [389, 356], [397, 365], [400, 377], [454, 323],
]

export const FACEMESH_NOSE = [
  [1, 19], [2, 326], [4, 1], [4, 45], [5, 4], [6, 197], [19, 94], [45, 220],
  [48, 64], [64, 98], [94, 2], [97, 2], [98, 97], [115, 48], [168, 6], [195, 5],
  [197, 195], [220, 115], [275, 4], [278, 344], [294, 278], [326, 327], [327, 294], [344, 440],
  [440, 275],
]

/**
 * Qoves-style nose for prototypicality mesh:
 * vertical bridge stops at tip (4); triangle continues tip → alae → alae.
 */
export const PROTOTYPICALITY_NOSE = [
  [168, 6], [6, 197], [197, 195], [195, 5], [5, 4],
  [4, 98], [4, 327], [98, 327],
]

/**
 * Jaw/cheek U outline for prototypicality — near eye/temple → chin → near eye/temple.
 * Omits forehead arc of FACEMESH_FACE_OVAL.
 */
export const PROTOTYPICALITY_FACE_OUTLINE = [
  [162, 127], [127, 234], [234, 93], [93, 132], [132, 58], [58, 172], [172, 136], [136, 150],
  [150, 149], [149, 176], [176, 148], [148, 152],
  [152, 377], [377, 400], [400, 378], [378, 379], [379, 365],
  [365, 397], [397, 288], [288, 361], [361, 323], [323, 454], [454, 356], [356, 389],
]

/**
 * Thick polygonal brows (Qoves-style): upper ridge + lower ridge closed at inner/outer tips.
 * Person's right / left.
 */
export const PROTOTYPICALITY_RIGHT_EYEBROW = [
  [70, 63], [63, 105], [105, 66], [66, 107],
  [107, 55], [55, 65], [65, 52], [52, 53], [53, 46],
  [46, 70],
]

export const PROTOTYPICALITY_LEFT_EYEBROW = [
  [300, 293], [293, 334], [334, 296], [296, 336],
  [336, 285], [285, 295], [295, 282], [282, 283], [283, 276],
  [276, 300],
]

/** Notebook CONNECTIONS used for prototypicality shape mesh. */
export const PROTOTYPICALITY_MESH_CONNECTIONS = [
  FACEMESH_LIPS,
  FACEMESH_LEFT_EYE,
  PROTOTYPICALITY_LEFT_EYEBROW,
  FACEMESH_RIGHT_EYE,
  PROTOTYPICALITY_RIGHT_EYEBROW,
  PROTOTYPICALITY_FACE_OUTLINE,
  PROTOTYPICALITY_NOSE,
]
