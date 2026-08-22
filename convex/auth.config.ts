// Convex Auth issues its own JWTs; the deployment's site URL is the issuer.
// Without this file `ctx.auth.getUserIdentity()` always returns null.
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
