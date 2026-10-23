/** Said wherever a ride or effort has no power, so a rider understands why GritMap cannot pace or judge it. */
export const NO_POWER_RIDE_NOTE =
  "This ride has no power data. GritMap's pacing needs power: ride with a power meter and import that ride to see how you did against a plan.";

export const NO_POWER_COMPARE = {
  title: "This ride has no power",
  body: "Pacing needs power, so GritMap can't compare this ride with a plan. Ride with a power meter and import that ride to see how you did.",
} as const;
