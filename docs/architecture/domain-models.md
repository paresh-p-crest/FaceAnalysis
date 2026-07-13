# Domain Models & Database Schemas

All databases collections reside in MongoDB. The repositories located in `backend/repositories/` perform all operations against these collections.

---

## 1. Collection: `users`
Stores account and credentials for users and administrators.

### Schema Fields
| Field | Type | Description |
|---|---|---|
| `_id` | `ObjectId` | Primary key (represented as `id` string in API) |
| `email` | `string` | User's unique email address |
| `passwordHash` | `string` | PBKDF2 + HMAC password hash (never stored in plaintext) |
| `role` | `string` | Permission role: `"user"` \| `"admin"` |
| `createdAt` | `ISODate` | Date of account registration |
| `updatedAt` | `ISODate` | Date of last profile update |

### Indexes
- `email` (Unique)
- `role`

---

## 2. Collection: `assessments`
Stores raw user inputs, computer vision analysis outputs, AI-generated reports, and administrative review records.

### Schema Fields
| Field | Type | Description |
|---|---|---|
| `_id` | `ObjectId` | Primary key (represented as `id` string in API) |
| `status` | `string` | Flow status: `"draft"` \| `"pending_review"` \| `"approved"` \| `"published"` |
| `userId` | `string` \| `null` | Reference to user owning the assessment |
| `scanId` | `string` \| `null` | Client-generated unique scan ID to prevent duplicate submissions |
| `answers` | `dict` | Questionnaire responses |
| `provider` | `string` | Core CV engine provider: `"local"` only (legacy `"openai"` requests are normalized to `"local"`) |
| `photosKeys` | `list[string]` | Pose IDs present (backward compat): `front`, `leftProfile`, `rightProfile`, `left45`, `right45`, `smile`, `topHead` |
| `photos` | `dict` | Per-pose storage metadata: `{ poseId, relativePath, publicUrl, contentType, byteSize, storedAt }` |
| `analysis` | `dict` | Nested object containing raw CV calculations (see sub-schema below) |
| `aiNarrative` | `dict` \| `null` | Latest executive narrative: `{ source, model, generatedAt?, content: { summary, strengths[], focusAreas[], recommendations[], disclaimer } }` |
| `protocolNarrative` | `dict` \| `null` | Latest protocol copy: `{ summary, closing[], features{}, source?, model? }` — overview + closing + feature shim for Qoves PDF/UI |
| `featureNarratives` | `dict` \| `null` | Canonical per-feature pages keyed by id (`measuredFacts`, `subsections[]`, `limitations`, …) — source for PDF pages 6–15 |
| `protocolStorage` | `dict` \| `null` | Protocol file metadata (`relativePath`, `publicUrl`, `storedAt`, `byteSize`) |
| `aiVisuals` | `dict` \| `null` | Latest visual variants: `{ source, model, sourceKind?, generatedAt?, variants: [{ type, title, prompt, imageSrc?, status, error? }] }` — `prompt` required on every variant |
| `adminNotes` | `string` \| `null` | Notes added by the administrator during review |
| `reviewedBy` | `dict` | Metadata of the reviewer (`email`, `role`, etc.) |
| `reviewedAt` | `ISODate` \| `null` | Timestamp of administrative review completion |
| `reviewLog` | `list[dict]` | Historical log of status changes and edits made during review |
| `createdAt` | `ISODate` | Date of upload / submission |
| `updatedAt` | `ISODate` | Date of last update |

### Analysis Sub-Schema (`analysis`)
| Nested Field | Type | Description |
|---|---|---|
| `cvReport` | `dict` | Calculated facial metrics; includes `profile`, `quarter`, `photos`, `meta.pipelineVersion`; `eyes` has sub-slices `eyebrows`, `eyelashes`, `ocular`, `underEye`; `nose` includes profile angles when measured. `profile.primary.overlay` holds chin/profile guides: `convexityPoints` (G/Sn/Pog, 0–1), `eLine` (pronasale→pogonion, 0–1), `nasoAural` (0–100 percent horizontals/segments). PDF chin projection plate pitches the profile (chin-down), then resolves Pn/Sn/Pog on that bitmap via `resolveChinProjectionOverlay` in `utils/chinProfileGuides.js` (collapsed stored silhouettes are not used as absolute coords). Full anonymized sample: `fixtures/assessment_sample_full.json`. |
| `landmarks` | `list[list[float]]` or `list[{x,y,z}]` | 478 MediaPipe Face Mesh coordinates. Used by PDF cheek ANALYSIS guides (`utils/cheekGuides.js`: 130/359 outer eyes, 102/331 outer nostrils, 61/291 mouth, 234/454 ears + 1.08× extension, 197/2 nose blend) and chin/feature crops. |
| `imagePreview` | `string` | Base64-encoded image preview or thumbnail |
| `faceDetails` | `dict` \| `null` | Reserved; always `null` (AWS Rekognition removed) |
| `protocolWarnings` | `list[string]` | Flagged issue warnings (e.g. head pose off-angle, eyes closed) |

### Indexes
- `createdAt`
- `status`
- `userId`
- `userId + scanId` (Unique compound index)

### Generated text (latest-only source of truth)

All NL / coaching text for a report is stored as the **latest** value only (no generation history). Completeness helper: `backend/report_content.report_content_status`.

| Surface | Location |
|---------|----------|
| Executive narrative | `assessments.aiNarrative` |
| Protocol overview + closing + feature shim | `assessments.protocolNarrative` (+ mirror `protocol.json`) |
| Per-feature protocol pages | `assessments.featureNarratives` (+ mirror `protocol.json`) |
| AI visual prompts / images | `assessments.aiVisuals` (`variants[].prompt` always present) |
| Beauty Assistant chat | `conversations` linked by `assessmentId` + `userId` (not embedded on the assessment) |

`protocol.json` under `public/uploads/assessments/{id}/` mirrors `{ protocolNarrative, featureNarratives }` only. Mongo wins on load when those fields are complete. Legacy `protocolData` (action cards) is removed; new writes `$unset` it.

---

## 3. Collection: `payments`
Tracks transactions generated via Stripe Checkout and PayPal REST client.

### Schema Fields
| Field | Type | Description |
|---|---|---|
| `_id` | `ObjectId` | Primary key (represented as `id` string in API) |
| `userId` | `string` | Reference to User who initiated transaction |
| `assessmentId` | `string` \| `null` | Reference to Assessment being purchased |
| `provider` | `string` | Payment portal: `"stripe"` \| `"paypal"` |
| `providerRef` | `string` \| `null` | Stripe Session ID or PayPal Order ID |
| `checkoutUrl` | `string` \| `null` | URL redirecting user to the Stripe/PayPal checkout flow |
| `amountCents` | `int` | Transaction amount in cents (e.g. `50` for $0.50) |
| `currency` | `string` | Lowercase standard currency code (e.g. `"usd"`) |
| `planId` | `string` | Purchased product plan tier (e.g. `"premium_report"`) |
| `status` | `string` | Provider state: `"pending"` \| `"paid"` \| `"complete"` \| `"completed"` \| `"failed"` \| `"expired"` |
| `raw` | `dict` | Complete webhook payload or response metadata from provider |
| `createdAt` | `ISODate` | Date transaction record was initialized |
| `updatedAt` | `ISODate` | Date status was last modified |

### Indexes
- `userId`
- `providerRef`
- `status`
- `createdAt`

---

## 4. Collection: `conversations`
Maintains conversational history between clients and the report-grounded Beauty Assistant.

### Schema Fields
| Field | Type | Description |
|---|---|---|
| `_id` | `ObjectId` | Primary key (represented as `id` string in API) |
| `assessmentId` | `string` | Reference to assessment coordinates used as context grounding |
| `userId` | `string` | Reference to User participating in chat |
| `messages` | `list[dict]` | Ordered list of messages (see format below) |
| `sessionSummary` | `string` \| `null` | Compressed coaching context for cost-efficient follow-up turns |
| `summaryAtUserCount` | `int` \| `null` | User message count when `sessionSummary` was last refreshed |
| `createdAt` | `ISODate` | Conversation session start date |
| `updatedAt` | `ISODate` | Last message exchange date |

### Message Format (`messages` element)
| Nested Field | Type | Description |
|---|---|---|
| `role` | `string` | Message author: `"user"` \| `"assistant"` |
| `content` | `string` | Text content |
| `createdAt` | `ISODate` | Delivery timestamp |

### Indexes
- `assessmentId + userId` (Unique compound index)
- `updatedAt`

Beauty Assistant replies for a report live here (not on `assessments`). Seed + tools read assessment narrative/CV fields; message history + `sessionSummary` are the durable chat text.

---

## 5. Collection: `app_settings`
Global application settings and default configuration values.

### Schema Fields
| Field | Type | Description |
|---|---|---|
| `_id` | `string` | Primary key (always `"app"`) |
| `premiumAmountCents` | `int` | Default pricing for report upgrade (in cents) |
| `premiumCurrency` | `string` | Currency code for payments (e.g. `"usd"`) |
| `productName` | `string` | Display name on the payment gateway |
| `productDescription` | `string` | Product line description shown during checkout |
| `updatedAt` | `ISODate` | Timestamp of last modification |
| `updatedBy` | `string` \| `null` | Reference to admin who adjusted values |

---

## 6. Collection: `assistant_rate_limits`
Tracks hourly Beauty Assistant message quotas per user.

### Schema Fields
| Field | Type | Description |
|---|---|---|
| `_id` | `ObjectId` | Primary key |
| `userId` | `string` | User being rate-limited |
| `hourBucket` | `string` | UTC hour key (`YYYY-MM-DDTHH`) |
| `count` | `int` | Messages sent in this hour |
| `createdAt` | `ISODate` | First message in bucket |

### Indexes
- `userId + hourBucket` (Unique compound index)
