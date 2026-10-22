
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
  // Retrieve recent and upcoming Sunday plans for both Burk teams.
const teams = [
  { id: "1770310", name: "Weekend Ministry Teams – Burk Campus" },
  { id: "1770597", name: "Burk Creative Teams" }
];

const today = new Date();
const startDate = new Date(today);
startDate.setUTCDate(startDate.getUTCDate() - 28);

const formatDate = (date) => date.toISOString().slice(0, 10);

const schedules = await Promise.all(
  teams.map(async (team) => {
    const url = new URL(
      `https://api.planningcenteronline.com/services/v2/service_types/${team.id}/plans`
    );

    url.searchParams.set(
      "filter",
      "after"
    );
    url.searchParams.set("after", formatDate(startDate));
    url.searchParams.set("per_page", "100");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(
        `Planning Center plans request failed for ${team.id}: ${response.status}`
      );
    }

    const result = await response.json();
if (team.id === "1770310") {
  const firstPlan = (result.data || [])[0];

  if (firstPlan) {
    const assignmentsResponse = await fetch(
      `https://api.planningcenteronline.com/services/v2/service_types/${team.id}/plans/${firstPlan.id}/team_members?per_page=1`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: "application/json"
        }
      }
    );

    if (!assignmentsResponse.ok) {
      throw new Error(
        `Volunteer assignments request failed: ${assignmentsResponse.status}`
      );
    }

   team.assignmentTest = {
  planId: firstPlan.id,
  recordsReturned: assignments.data?.length ?? 0,
  responseStatuses: (assignments.data || []).map((member) => ({
    status: member.attributes.status || "unknown"
  }))
};
  }
}
    return {
  team: team.name,
  serviceTypeId: team.id,
  assignmentTest: team.assignmentTest || null,
  plans: (result.data || []).map((plan) => ({
        id: plan.id,
        dates: plan.attributes.dates,
        sortDate: plan.attributes.sort_date
      }))
    };
  })
);

return res.status(200).json({
  connected: true,
  message: "Burkburnett plans retrieved",
  planCounts: schedules.map((team) => ({
    team: team.team,
    count: team.plans.length
  })),
  schedules
});

  } catch (error) {
    console.error("Planning Center connection test failed:", error);
    return res.status(500).json({ error: "Connection test failed" });
  }
}
