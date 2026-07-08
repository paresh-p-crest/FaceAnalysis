# API Mocked Endpoints (Planned/Stubbed)

This document lists planned, stubbed endpoints not yet implemented. Front-end developers should mock these requests in the user interface using the sample payloads provided below.

*Currently, no mocked endpoints are active. All planned backend endpoints have been migrated to LIVE. See [API Contracts](file:///c:/Users/JayRabari/Documents/FacialAnalysis/docs/architecture/api-contracts.md) for active endpoints.*

---

## Example Format (For Future Mocked Endpoints)

### `POST /api/assessments/{id}/example-mock`
Example of a mocked route descriptor.
- **Status:** `MOCKED`
- **Request Body:**
  ```json
  {
    "param": "value"
  }
  ```
- **Response Shape (Mocked Payload):**
  ```json
  {
    "mocked": true,
    "result": "success"
  }
  ```
- **FE instruction:** Use the mocked payload above when hitting this path on the front-end until status flips to `LIVE` in [API Contracts](file:///c:/Users/JayRabari/Documents/FacialAnalysis/docs/architecture/api-contracts.md).
