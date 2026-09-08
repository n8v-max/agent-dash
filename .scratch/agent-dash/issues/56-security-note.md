Type: implementation
Status: ready-for-agent
Blocked by:
Label: ready-for-agent

# `docs/security.md`

## Scope

One page: JWT in an HttpOnly cookie, signed with `AUTH_JWT_SECRET`, rotation procedure; CSRF
posture for the single POST endpoint (SameSite, origin check, whether a token is needed); the
404-not-403 tenancy rule and why; enforcement in the data layer, never the client; what is not
done (rate limiting, audit log) and why it is acceptable for a demo. Verify each claim against the
code and cite the file.

## Done when

File exists and every claim has a code reference.
