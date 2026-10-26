---
public: true
writes: true
public-writes: true
---

Anyone can call this with no authentication.
Path: POST `/users/v1/register`
This creates a row.

The body is an email, a password, and a display name. The response is an access token.
