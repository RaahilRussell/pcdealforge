import { compatibilityRules } from "./rules";
import type { CompatibilityCheckInput, CompatibilityLevel, CompatibilityReport } from "./types";

export function checkBuild(input: CompatibilityCheckInput): CompatibilityReport {
  const results = compatibilityRules.flatMap((rule) => rule(input));
  const passCount = results.filter((result) => result.level === "PASS").length;
  const warningCount = results.filter((result) => result.level === "WARNING").length;
  const failCount = results.filter((result) => result.level === "FAIL").length;
  const overallStatus: CompatibilityLevel =
    failCount > 0 ? "FAIL" : warningCount > 0 ? "WARNING" : "PASS";

  return {
    overallStatus,
    passCount,
    warningCount,
    failCount,
    results,
  };
}
