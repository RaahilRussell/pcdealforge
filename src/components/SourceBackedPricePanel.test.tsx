// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SourceBackedPricePanel } from "./SourceBackedPricePanel";

describe("SourceBackedPricePanel", () => {
  it("renders the primary verdict reason next to the verdict", () => {
    render(
      <SourceBackedPricePanel
        trends={[
          {
            productName: "GeForce RTX 5070",
            currentPrice: 649,
            thirtyDayLow: 620,
            ninetyDayLow: 599,
            oneEightyDayLow: 549,
            ninetyDayAverage: 599,
            verdict: "WAIT",
            verdictDetails: {
              verdict: "WAIT",
              primaryReason: {
                severity: "warning",
                code: "price_5_to_15_above_90_day_average",
                title: "Above 90-day average",
                explanation:
                  "GeForce RTX 5070 is $50 above its 90-day average of $599, so this is a wait signal rather than an avoid signal.",
                currentValue: 649,
                comparisonValue: 599,
                deltaDollars: 50,
                deltaPercent: 8.35,
                affectedPartName: "GeForce RTX 5070",
              },
              summary: "WAIT because above 90-day average.",
              specificJustification:
                "GeForce RTX 5070 is $50 above its 90-day average of $599, so this is a wait signal rather than an avoid signal.",
            },
            explanation: "Legacy explanation",
            evidence: [],
          },
        ]}
      />,
    );

    expect(screen.getByText(/WAIT: GeForce RTX 5070 is \$50 above its 90-day average/i)).toBeTruthy();
    expect(screen.getByText("Above 90-day average")).toBeTruthy();
  });
});
