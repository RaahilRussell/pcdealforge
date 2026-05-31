import { z } from "zod";

export const compatibilityCheckSchema = z.object({
  partIds: z.object({
    cpu: z.string().min(1),
    gpu: z.string().min(1),
    motherboard: z.string().min(1),
    ram: z.string().min(1),
    storage: z.string().min(1),
    psu: z.string().min(1),
    case: z.string().min(1),
    cooler: z.string().min(1),
  }),
  wifiRequired: z.boolean().default(false),
});

export const generateBuildSchema = z.object({
  budget: z.number().min(400).max(10000),
  useCase: z.enum(["gaming", "workstation", "general"]).default("gaming"),
  resolution: z.enum(["1080p", "1440p", "4k"]).default("1440p"),
  gpuPreference: z.enum(["any", "nvidia", "amd"]).default("any"),
  ramGb: z.number().min(16).max(256).default(32),
  storageGb: z.number().min(500).max(8000).default(1000),
  wifiRequired: z.boolean().default(true),
  riskTolerance: z.enum(["new_only", "open_box_allowed", "used_allowed"]).default("open_box_allowed"),
});

export const dealsRefreshSchema = z
  .object({
    adapter: z.enum(["mock"]).default("mock"),
  });

export const buildVariantSchema = z.enum(["bestOverall", "cheapestSafe", "bestPerformancePerDollar"]);

export const buildAnalysisSchema = generateBuildSchema.extend({
  variant: buildVariantSchema.default("bestOverall"),
});

export const buildEvidenceSchema = buildAnalysisSchema;

export const compareBuildsSchema = generateBuildSchema;
