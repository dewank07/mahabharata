import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

// Mounts /api/auth/* — the OAuth callback endpoints Convex Auth needs.
auth.addHttpRoutes(http);

export default http;
