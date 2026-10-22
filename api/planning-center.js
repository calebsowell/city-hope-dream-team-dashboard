
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Sign-in required" });
    }

    const token = authorization.slice(7);

    // Verify the Google/Supabase session on the server.
    const userResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!userResponse.ok) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const user = await userResponse.json();

    // Check the approved-users list using the user's token.
    const approvalResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/approved_users?select=user_id&user_id=eq.${encodeURIComponent(user.id)}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!approvalResponse.ok) {
      return res.status(403).json({ error: "Approval check failed" });
    }

    const approvals = await approvalResponse.json();

    if (!Array.isArray(approvals) || approvals.length !== 1) {
      return res.status(403).json({ error: "Account not approved" });
    }

    // Credentials stay on Vercel's server.
    const clientId = process.env.PLANNING_CENTER_CLIENT_ID;
    const clientSecret = process.env.PLANNING_CENTER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(503).json({ error: "Planning Center not configured" });
    }

    const credentials = Buffer.from(
      `${clientId}:${clientSecret}`
    ).toString("base64");

    // Read-only test of Planning Center connectivity.
    const pcResponse = await fetch(
      "https://api.planningcenteronline.com/people/v2/me",
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: "application/json"
        }
      }
    );

    if (!pcResponse.ok) {
      return res.status(502).json({
        error: "Planning Center connection unsuccessful",
        upstreamStatus: pcResponse.status
      });
    }

    return res.status(200).json({
      connected: true,
      message: "Planning Center connection successful"
    });

  } catch (error) {
    console.error("Planning Center connection test failed:", error);
    return res.status(500).json({ error: "Connection test failed" });
  }
}
