# Import Session architecture

Import Session is a review-first adapter into Setra's existing template models. It does not create a parallel workout format.

## Flow

1. A client creates an `ImportSessionPayload` from pasted text, an uploaded file, or a future native share extension.
2. The authenticated server endpoint extracts temporary text and immediately discards the source file.
3. A parser produces a strict intermediate result: modality, confidence, issues, and a draft strength or endurance template.
4. The user reviews exercise matches, prescriptions, groups, targets, and notes.
5. Only an explicit save writes to the existing user-owned template tables under their existing Row Level Security policies.

## Exercise matching

Only exact catalogue names and a small, explicit alias list are automatically matched. Fuzzy candidates are suggestions only. Unmatched movements must be mapped to an existing exercise or deliberately created as a custom exercise, preventing silent catalogue duplication.

## Files and privacy

Text and Markdown extraction work without an external provider. Image and PDF recognition are represented by the same server-only boundary but remain disabled until a suitable OCR/vision provider is configured. Raw uploads are not written to storage or logs.

## Future mobile sharing

An iOS share extension or Android share target can submit the same payload shape with a source app and source timestamp. The parser and canonical templates are independent of Next.js UI code, so a native client can show its own review screen while using the same rules.

## Future AI extraction

An AI extractor should sit behind the server boundary and return the same strict intermediate result. It must never write directly to Supabase, expose provider credentials to a client, or bypass review and validation.
