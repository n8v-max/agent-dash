Type: implementation
Status: ready-for-agent
Blocked by: 48
Label: ready-for-agent

# ADR-0010 — Bring-your-own-key splits Total spend (deferred)

## Scope

Decision record only, no code. Under BYOK, token cost lands on the customer's vendor invoice and
the platform bills seats and machine time. Total spend then hides most of the money. Intended
change: `billing_owner: "platform" | "customer_key"` on TokenUsage; Total spend renders two stacks,
"billed by us" and "billed by your vendor"; hidden-session cost cannot be absorbed by the platform
under a customer key, so the hidden rule needs a second clause. State why it is deferred and what
it costs to retrofit.

## Done when

`docs/adr/0010-byok.md` exists, status Proposed, linked from the roadmap.
