import { RekognitionClient, DetectFacesCommand } from '@aws-sdk/client-rekognition'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { imageBase64, accessKeyId, secretAccessKey, sessionToken, region } = req.body || {}

    if (!imageBase64 || !accessKeyId || !secretAccessKey) {
      return res.status(400).json({ error: 'Missing image or AWS credentials' })
    }

    const credentials = { accessKeyId, secretAccessKey }
    if (sessionToken) credentials.sessionToken = sessionToken

    const client = new RekognitionClient({
      region: region || 'us-east-1',
      credentials,
    })

    const command = new DetectFacesCommand({
      Image: { Bytes: Buffer.from(imageBase64, 'base64') },
      Attributes: ['ALL'],
    })

    const response = await client.send(command)
    const faceDetails = response.FaceDetails?.[0] || null

    if (!faceDetails) {
      return res.status(422).json({ error: 'No face detected in image' })
    }

    return res.status(200).json({ faceDetails })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Rekognition error' })
  }
}
