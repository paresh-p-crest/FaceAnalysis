# AuraScan — How It Works

A simple, non-technical guide to what AuraScan does, how the AI facial analysis works, and what you get with different configurations.

---

## What Is AuraScan?

AuraScan is an AI-powered facial analysis platform. You upload a photo, answer a few quick questions, and get a detailed report analyzing your facial features — symmetry, proportions, jawline, nose, lips, skin quality, and more.

It works entirely in your browser. No photos are uploaded to any server (except when using AWS). Everything runs locally.

---

## How Does the Analysis Work?

The app uses **two AI systems** working together:

1. **MediaPipe Face Mesh** (by Google) — Detects **478 points** on your face in 3D. Think of it as a precise digital mesh that maps every contour — your jawline, nose bridge, lip edges, eye corners, eyebrow arch, etc. All measurements (symmetry, proportions, face shape) come from these points.

2. **Canvas Pixel Analysis** — Samples actual pixel colors from 6 regions of your face (forehead, both cheeks, nose, chin, under-eye) to measure real skin quality — brightness, redness, tone uniformity, and clarity.

These two systems run entirely in your browser. No API key needed. No data sent anywhere.

---

## What Report Do You Get?

After analysis, you see a **structured sidebar report** with 11 sections:

| Section | What It Shows |
|---------|---------------|
| **Executive Summary** | Overall score (out of 100), feature breakdown bar chart, strengths & areas to improve |
| **Face Shape** | Your face shape (Oval, Round, Square, Heart, Oblong) with metrics |
| **Symmetry** | Left-right balance score with visual overlay on your photo |
| **Proportions** | Vertical thirds analysis (upper/middle/lower face ratios) |
| **Jaw & Chin** | Jaw angle, chin type, face ratio, projection |
| **Eyes** | Canthal tilt, eyelid exposure, sclera health, under-eye assessment |
| **Eyebrows** | Position, tilt, shape, virility score |
| **Nose** | Width class, bridge width, nose-to-face ratio |
| **Lips** | Fullness, philtrum ratio, width ratio |
| **Skin Quality** | Brightness, redness, tone uniformity, clarity — from real pixel data |
| **Protocol** | Personalized recommendations (AI-generated or template-based) |

---

## Free vs AWS — What's the Difference?

This is the most important question. Here's the short answer:

> **Without AWS, you still get the full 11-section structured report with all facial feature analysis.** AWS adds extra intelligence about photo quality and facial attributes — it does NOT change the core measurements.

### What You Get FREE (No API Keys Needed)

Everything runs in your browser using MediaPipe + pixel analysis:

- ✅ **478-point face mesh** — the foundation of all measurements
- ✅ **Face shape** classification (Oval, Round, Square, Heart, Oblong)
- ✅ **Symmetry** score with visual overlay dots on your photo
- ✅ **Vertical proportions** (upper/middle/lower third ratios)
- ✅ **Jaw & chin** analysis (angle, shape, projection)
- ✅ **Nose** analysis (width, bridge, ratio)
- ✅ **Lip** analysis (fullness, philtrum, width)
- ✅ **Eyebrow** analysis (position, tilt, shape)
- ✅ **Eye** analysis (canthal tilt, eyelid, sclera, under-eye)
- ✅ **Skin quality** (real pixel analysis from 6 face regions)
- ✅ **Full structured sidebar report** with all 11 sections
- ✅ **Personalized protocol** (if OpenAI key is set, uses GPT; otherwise uses smart templates)
- ✅ **$0 cost** — nothing runs on any server

### What AWS REKOGNITION Adds

AWS Rekognition is a cloud service (~$0.004 per photo) that analyzes your photo from a different angle. It adds **extras** that the free version can't do:

| Extra Feature | What It Does | Why It Matters |
|---------------|-------------|----------------|
| **Emotion detection** | Detects Happy, Calm, Sad, Angry, etc. with confidence percentages | Adds personality to your report |
| **Head pose** | Exact Yaw, Pitch, Roll in degrees | Knows if your photo was taken at an angle |
| **Image quality scores** | Sharpness and Brightness scores | Tells you if your photo is blurry or poorly lit |
| **Glasses detection** | Detects eyeglasses and sunglasses | Can warn you to remove them for better analysis |
| **Smile detection** | Detects if you're smiling (with confidence) | Noted in your facial attributes |
| **Facial hair** | Detects beard and mustache | Documented in your profile |
| **Auto protocol warnings** | Automatically warns about bad photo conditions | "Photo is blurry", "Off-angle detected", "Glasses detected", "Eyes closed" |
| **Detection confidence** | How confident AWS is that it found a face | Quality indicator |

### What You DON'T Get With AWS Alone

Here's the surprise — **AWS alone gives you LESS than free mode**:

| Missing With AWS | Why |
|-------------------|-----|
| Nose metrics | Rekognition doesn't measure nose proportions |
| Lip analysis | Rekognition doesn't analyze lips |
| Jaw/chin analysis | Rekognition doesn't measure jaw angle or chin projection |
| Eyebrow analysis | Rekognition doesn't analyze eyebrows |
| Eye health | Rekognition doesn't check canthal tilt or under-eye |
| Skin quality | Rekognition doesn't do pixel-level skin analysis |
| Face shape classification | Rekognition detects a face but doesn't classify shape |
| Structured sidebar report | AWS generates a markdown document, not the visual sidebar |

**This is why AuraScan runs BOTH together** — when AWS is enabled, the app runs MediaPipe AND Rekognition in parallel. You get the best of both worlds.

### Side-by-Side Summary

| Feature | Free (Local) | Free + AWS | Free + OpenAI |
|---------|:---:|:---:|:---:|
| Face measurements (symmetry, nose, lips, jaw, etc.) | ✅ | ✅ | ✅ |
| Skin quality (pixel analysis) | ✅ | ✅ | ✅ |
| Eye analysis | ✅ | ✅ | ❌ |
| Structured sidebar report | ✅ | ✅ | ❌ |
| Emotion detection | ❌ | ✅ | ❌ |
| Photo quality warnings | ❌ | ✅ | ❌ |
| Glasses/accessories detection | ❌ | ✅ | ❌ |
| Head pose (exact angles) | ❌ | ✅ | ❌ |
| AI-generated narrative report | ❌ | ❌ | ✅ |
| AI protocol (personalized) | ✅¹ | ✅¹ | ✅ |
| Cost per photo | **$0** | **~$0.004** | **~$0.005** |

¹ If OpenAI key is set, protocol is AI-generated. Otherwise template-based.

---

## What About OpenAI?

OpenAI is a **separate provider** that replaces the local analysis with GPT-generated reports:

- You upload your photo + answer questions
- The app sends your metrics to GPT-4o-mini
- GPT writes a **narrative report** in natural language

**Trade-off:** You get a nicely written report, but you **lose the structured sidebar** (no score ring, no visual overlays, no feature-by-feature breakdown). The OpenAI provider only generates markdown text — it doesn't produce the detailed visual report that the free/AWS providers do.

**Best setup:** Use **Free + AWS** for the best experience — you get everything: the structured visual report, all measurements, plus AWS extras like emotion detection and photo quality warnings.

---

## Quick Setup Guide

1. **Just try it free** — Open the app and click "Start Analysis". No setup needed.
2. **Want more features?** — Go to Settings → AWS tab → Enter your Rekognition credentials. Click "Test Connection" to verify.
3. **Want AI protocols?** — Go to Settings → OpenAI tab → Enter your API key. Protocols become AI-personalized.

All settings are saved in your browser. Nothing is stored on any server.

---

## Pricing at a Glance

| Provider | Cost | What You Pay For |
|----------|------|-----------------|
| Free | $0 | Everything runs in your browser |
| AWS Rekognition | ~$0.004/photo | Extra detection: emotions, pose, quality, glasses |
| OpenAI GPT-4o-mini | ~$0.005/report | AI-generated narrative + personalized protocol |

---

*Last updated: 2026-07-01*
