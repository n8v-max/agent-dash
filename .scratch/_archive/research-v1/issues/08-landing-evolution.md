Type: research
Status: ready-for-human
Priority: MEDIUM

# Define landing page evolution seam

## Question

Should the landing page route be architected now to receive future sections (/features, /pricing, /compare) without a rewrite?

## Context

Current landing scope: minimal gateway — hero ("Ship faster. Know why."), demo CTA, sign-in link. No marketing sub-pages in MVP (Q15). But the product will grow.

## Decision

Next.js App Router segment-based routing makes this trivial: `app/(marketing)/features/page.tsx` etc. can be added at any point without touching the existing route. The extension seam is free — it just needs to be flagged explicitly in the tech spec so future agents don't accidentally break the layout.

## What needs deciding

1. Should the landing layout (`app/(marketing)/layout.tsx`) be extracted as a distinct layout group now, or left flat?
   - Recommendation: yes — a `(marketing)` route group cleanly separates public marketing from the authenticated app shell. Zero runtime cost, huge future-proofing value.

2. What signals would trigger actually adding /features, /pricing, /compare?
   - Recruiter or CEO asks for a full site after the interview
   - Platform exits "imaginary product" phase and needs real SEO/conversion pages

## Feeds into

Tech spec (`docs/specs/technical.md`) — note extension point explicitly so it's not lost.

## Comments
