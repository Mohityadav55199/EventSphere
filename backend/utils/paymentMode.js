// Sandbox payment simulation is a local-development convenience only.
// In production a missing/invalid gateway key must fail the checkout, never "succeed".
export const isSandboxAllowed = () => process.env.NODE_ENV !== "production";

export const isSimulatedId = (id) =>
  typeof id === "string" && (id.startsWith("sim_cs_") || id.startsWith("order_sim_"));
