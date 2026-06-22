import { RekognitionClient, DetectFacesCommand } from '@aws-sdk/client-rekognition'

export function rekognitionApiPlugin() {
  return {
    name: 'rekognition-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/analyze-face' || req.method !== 'POST') {
          return next()
        }

        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', async () => {
          try {
            const { imageBase64, accessKeyId, secretAccessKey, sessionToken, region } = JSON.parse(body)

            if (!imageBase64 || !accessKeyId || !secretAccessKey) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Missing image or AWS credentials' }))
              return
            }

            const credentials = { accessKeyId, secretAccessKey }
            // Required for AWS Academy / sandbox temp creds (keys starting with ASIA)
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
              res.statusCode = 422
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'No face detected in image' }))
              return
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ faceDetails }))
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message || 'Rekognition error' }))
          }
        })
      })
    },
  }
}
