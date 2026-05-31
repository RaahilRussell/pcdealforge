import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";

type Category =
  | "cpu"
  | "gpu"
  | "motherboard"
  | "ram"
  | "storage"
  | "psu"
  | "case"
  | "cooler";

type ProductSeed = {
  id: string;
  category: Category;
  brand: string;
  model: string;
  mpn?: string;
  upc?: string;
  specs: Record<string, unknown>;
  priceProfile: {
    current: number;
    average: number;
    low: number;
    volatility: number;
    retailerCount: number;
  };
};

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

const prisma = new PrismaClient({ adapter });

const anchorDate = new Date("2026-05-31T12:00:00.000Z");

const products: ProductSeed[] = [
  {
    id: "cpu-ryzen-5-7600",
    category: "cpu",
    brand: "AMD",
    model: "Ryzen 5 7600",
    mpn: "100-100001015BOX",
    upc: "730143314572",
    specs: {
      socket: "AM5",
      tdp: 65,
      includesCooler: true,
      performanceScore: 78,
      supportedRamTypes: ["DDR5"],
    },
    priceProfile: { current: 178, average: 203, low: 169, volatility: 14, retailerCount: 5 },
  },
  {
    id: "cpu-ryzen-7-7800x3d",
    category: "cpu",
    brand: "AMD",
    model: "Ryzen 7 7800X3D",
    mpn: "100-100000910WOF",
    upc: "730143314831",
    specs: {
      socket: "AM5",
      tdp: 120,
      includesCooler: false,
      performanceScore: 97,
      supportedRamTypes: ["DDR5"],
    },
    priceProfile: { current: 344, average: 372, low: 329, volatility: 22, retailerCount: 5 },
  },
  {
    id: "cpu-ryzen-5-9600x",
    category: "cpu",
    brand: "AMD",
    model: "Ryzen 5 9600X",
    mpn: "100-100001405WOF",
    upc: "730143316095",
    specs: {
      socket: "AM5",
      tdp: 65,
      includesCooler: false,
      performanceScore: 88,
      supportedRamTypes: ["DDR5"],
      needsBiosVersion: "AGESA 1.2.0.0a or newer on older B650 boards",
    },
    priceProfile: { current: 226, average: 252, low: 219, volatility: 18, retailerCount: 4 },
  },
  {
    id: "cpu-ryzen-7-9700x",
    category: "cpu",
    brand: "AMD",
    model: "Ryzen 7 9700X",
    mpn: "100-100001404WOF",
    upc: "730143316088",
    specs: {
      socket: "AM5",
      tdp: 65,
      includesCooler: false,
      performanceScore: 91,
      supportedRamTypes: ["DDR5"],
      needsBiosVersion: "AGESA 1.2.0.0a or newer on older B650 boards",
    },
    priceProfile: { current: 309, average: 332, low: 299, volatility: 20, retailerCount: 4 },
  },
  {
    id: "cpu-intel-i5-14600k",
    category: "cpu",
    brand: "Intel",
    model: "Core i5-14600K",
    mpn: "BX8071514600K",
    upc: "735858547085",
    specs: {
      socket: "LGA1700",
      tdp: 181,
      includesCooler: false,
      performanceScore: 89,
      supportedRamTypes: ["DDR4", "DDR5"],
    },
    priceProfile: { current: 254, average: 281, low: 239, volatility: 17, retailerCount: 5 },
  },
  {
    id: "cpu-intel-i7-14700k",
    category: "cpu",
    brand: "Intel",
    model: "Core i7-14700K",
    mpn: "BX8071514700K",
    upc: "735858547092",
    specs: {
      socket: "LGA1700",
      tdp: 253,
      includesCooler: false,
      performanceScore: 96,
      supportedRamTypes: ["DDR4", "DDR5"],
    },
    priceProfile: { current: 369, average: 394, low: 349, volatility: 25, retailerCount: 4 },
  },
  {
    id: "cpu-ryzen-5-5600",
    category: "cpu",
    brand: "AMD",
    model: "Ryzen 5 5600",
    mpn: "100-100000927BOX",
    upc: "730143314381",
    specs: {
      socket: "AM4",
      tdp: 65,
      includesCooler: true,
      performanceScore: 61,
      supportedRamTypes: ["DDR4"],
    },
    priceProfile: { current: 109, average: 124, low: 98, volatility: 9, retailerCount: 5 },
  },
  {
    id: "cpu-intel-i5-12400f",
    category: "cpu",
    brand: "Intel",
    model: "Core i5-12400F",
    mpn: "BX8071512400F",
    upc: "735858499613",
    specs: {
      socket: "LGA1700",
      tdp: 117,
      includesCooler: true,
      performanceScore: 66,
      supportedRamTypes: ["DDR4", "DDR5"],
    },
    priceProfile: { current: 122, average: 139, low: 109, volatility: 10, retailerCount: 4 },
  },
  {
    id: "gpu-rtx-5060",
    category: "gpu",
    brand: "NVIDIA",
    model: "GeForce RTX 5060 8GB",
    mpn: "RTX5060-8G",
    upc: "812674029886",
    specs: {
      chipset: "RTX 5060",
      vramGb: 8,
      lengthMm: 240,
      slots: 2,
      tdp: 145,
      recommendedPsuW: 550,
      powerConnector: "1x8-pin",
      performanceScore: 72,
    },
    priceProfile: { current: 289, average: 309, low: 279, volatility: 16, retailerCount: 4 },
  },
  {
    id: "gpu-rtx-5070",
    category: "gpu",
    brand: "NVIDIA",
    model: "GeForce RTX 5070 12GB",
    mpn: "RTX5070-12G",
    upc: "812674030103",
    specs: {
      chipset: "RTX 5070",
      vramGb: 12,
      lengthMm: 285,
      slots: 2.5,
      tdp: 250,
      recommendedPsuW: 650,
      powerConnector: "12V-2x6",
      performanceScore: 105,
    },
    priceProfile: { current: 649, average: 599, low: 549, volatility: 34, retailerCount: 3 },
  },
  {
    id: "gpu-rtx-4070-super",
    category: "gpu",
    brand: "NVIDIA",
    model: "GeForce RTX 4070 Super 12GB",
    mpn: "RTX4070S-12G",
    upc: "812674029435",
    specs: {
      chipset: "RTX 4070 Super",
      vramGb: 12,
      lengthMm: 267,
      slots: 2.5,
      tdp: 220,
      recommendedPsuW: 650,
      powerConnector: "12VHPWR",
      performanceScore: 96,
    },
    priceProfile: { current: 529, average: 579, low: 499, volatility: 31, retailerCount: 5 },
  },
  {
    id: "gpu-rx-7800-xt",
    category: "gpu",
    brand: "AMD",
    model: "Radeon RX 7800 XT 16GB",
    mpn: "RX7800XT-16G",
    upc: "727419314604",
    specs: {
      chipset: "RX 7800 XT",
      vramGb: 16,
      lengthMm: 276,
      slots: 2.7,
      tdp: 263,
      recommendedPsuW: 700,
      powerConnector: "2x8-pin",
      performanceScore: 92,
    },
    priceProfile: { current: 459, average: 492, low: 439, volatility: 26, retailerCount: 5 },
  },
  {
    id: "gpu-rx-9070-xt",
    category: "gpu",
    brand: "AMD",
    model: "Radeon RX 9070 XT 16GB",
    mpn: "RX9070XT-16G",
    upc: "727419315151",
    specs: {
      chipset: "RX 9070 XT",
      vramGb: 16,
      lengthMm: 305,
      slots: 3,
      tdp: 304,
      recommendedPsuW: 750,
      powerConnector: "2x8-pin",
      performanceScore: 112,
    },
    priceProfile: { current: 619, average: 665, low: 589, volatility: 38, retailerCount: 4 },
  },
  {
    id: "gpu-rtx-4060",
    category: "gpu",
    brand: "NVIDIA",
    model: "GeForce RTX 4060 8GB",
    mpn: "RTX4060-8G",
    upc: "812674028995",
    specs: {
      chipset: "RTX 4060",
      vramGb: 8,
      lengthMm: 245,
      slots: 2,
      tdp: 115,
      recommendedPsuW: 550,
      powerConnector: "1x8-pin",
      performanceScore: 62,
    },
    priceProfile: { current: 269, average: 287, low: 249, volatility: 14, retailerCount: 5 },
  },
  {
    id: "gpu-rx-7600-xt",
    category: "gpu",
    brand: "AMD",
    model: "Radeon RX 7600 XT 16GB",
    mpn: "RX7600XT-16G",
    upc: "727419314123",
    specs: {
      chipset: "RX 7600 XT",
      vramGb: 16,
      lengthMm: 205,
      slots: 2.1,
      tdp: 190,
      recommendedPsuW: 600,
      powerConnector: "1x8-pin",
      performanceScore: 66,
    },
    priceProfile: { current: 299, average: 322, low: 269, volatility: 19, retailerCount: 4 },
  },
  {
    id: "gpu-rtx-5080",
    category: "gpu",
    brand: "NVIDIA",
    model: "GeForce RTX 5080 16GB",
    mpn: "RTX5080-16G",
    upc: "812674030189",
    specs: {
      chipset: "RTX 5080",
      vramGb: 16,
      lengthMm: 330,
      slots: 3.2,
      tdp: 360,
      recommendedPsuW: 850,
      powerConnector: "12V-2x6",
      performanceScore: 145,
    },
    priceProfile: { current: 1099, average: 1045, low: 949, volatility: 62, retailerCount: 3 },
  },
  {
    id: "mobo-msi-b650-tomahawk-wifi",
    category: "motherboard",
    brand: "MSI",
    model: "MAG B650 Tomahawk WiFi",
    mpn: "MAG-B650-TOMAHAWK-WIFI",
    upc: "824142304611",
    specs: {
      socket: "AM5",
      chipset: "B650",
      ramType: "DDR5",
      formFactor: "ATX",
      m2Slots: 3,
      sataPorts: 6,
      hasWifi: true,
      hasFrontUsbCHeader: true,
      pcieVersion: "PCIe 4.0",
      biosSupportJson: { "Ryzen 7000": "supported", "Ryzen 9000": "BIOS 7D75v1J or newer" },
      maxRamGb: 192,
    },
    priceProfile: { current: 189, average: 209, low: 179, volatility: 15, retailerCount: 5 },
  },
  {
    id: "mobo-gigabyte-b650-eagle-ax",
    category: "motherboard",
    brand: "Gigabyte",
    model: "B650 Eagle AX",
    mpn: "B650-EAGLE-AX",
    upc: "889523041247",
    specs: {
      socket: "AM5",
      chipset: "B650",
      ramType: "DDR5",
      formFactor: "ATX",
      m2Slots: 3,
      sataPorts: 4,
      hasWifi: true,
      hasFrontUsbCHeader: true,
      pcieVersion: "PCIe 4.0",
      biosSupportJson: { "Ryzen 7000": "supported", "Ryzen 9000": "BIOS F31 or newer" },
      maxRamGb: 192,
    },
    priceProfile: { current: 154, average: 169, low: 145, volatility: 12, retailerCount: 4 },
  },
  {
    id: "mobo-asrock-b650m-pro-rs-wifi",
    category: "motherboard",
    brand: "ASRock",
    model: "B650M Pro RS WiFi",
    mpn: "B650M-PRO-RS-WIFI",
    upc: "4710483942944",
    specs: {
      socket: "AM5",
      chipset: "B650",
      ramType: "DDR5",
      formFactor: "Micro ATX",
      m2Slots: 3,
      sataPorts: 4,
      hasWifi: true,
      hasFrontUsbCHeader: true,
      pcieVersion: "PCIe 4.0",
      biosSupportJson: { "Ryzen 7000": "supported", "Ryzen 9000": "BIOS 3.01 or newer" },
      maxRamGb: 192,
    },
    priceProfile: { current: 139, average: 154, low: 129, volatility: 11, retailerCount: 4 },
  },
  {
    id: "mobo-asus-tuf-b650-plus-wifi",
    category: "motherboard",
    brand: "ASUS",
    model: "TUF Gaming B650-Plus WiFi",
    mpn: "TUF-GAMING-B650-PLUS-WIFI",
    upc: "195553924111",
    specs: {
      socket: "AM5",
      chipset: "B650",
      ramType: "DDR5",
      formFactor: "ATX",
      m2Slots: 3,
      sataPorts: 4,
      hasWifi: true,
      hasFrontUsbCHeader: true,
      pcieVersion: "PCIe 4.0",
      biosSupportJson: { "Ryzen 7000": "supported", "Ryzen 9000": "BIOS 2613 or newer" },
      maxRamGb: 192,
    },
    priceProfile: { current: 199, average: 219, low: 189, volatility: 14, retailerCount: 4 },
  },
  {
    id: "mobo-msi-z790-tomahawk-wifi",
    category: "motherboard",
    brand: "MSI",
    model: "MAG Z790 Tomahawk WiFi DDR5",
    mpn: "MAG-Z790-TOMAHAWK-WIFI",
    upc: "824142304222",
    specs: {
      socket: "LGA1700",
      chipset: "Z790",
      ramType: "DDR5",
      formFactor: "ATX",
      m2Slots: 4,
      sataPorts: 7,
      hasWifi: true,
      hasFrontUsbCHeader: true,
      pcieVersion: "PCIe 5.0",
      biosSupportJson: { "Intel 12th": "supported", "Intel 13th": "supported", "Intel 14th": "supported" },
      maxRamGb: 192,
    },
    priceProfile: { current: 229, average: 249, low: 209, volatility: 18, retailerCount: 4 },
  },
  {
    id: "mobo-asus-prime-z790-p-wifi",
    category: "motherboard",
    brand: "ASUS",
    model: "Prime Z790-P WiFi DDR5",
    mpn: "PRIME-Z790-P-WIFI",
    upc: "195553923893",
    specs: {
      socket: "LGA1700",
      chipset: "Z790",
      ramType: "DDR5",
      formFactor: "ATX",
      m2Slots: 3,
      sataPorts: 4,
      hasWifi: true,
      hasFrontUsbCHeader: true,
      pcieVersion: "PCIe 5.0",
      biosSupportJson: { "Intel 12th": "supported", "Intel 13th": "supported", "Intel 14th": "supported" },
      maxRamGb: 192,
    },
    priceProfile: { current: 207, average: 226, low: 189, volatility: 16, retailerCount: 4 },
  },
  {
    id: "mobo-gigabyte-b760m-ds3h-ax-ddr4",
    category: "motherboard",
    brand: "Gigabyte",
    model: "B760M DS3H AX DDR4",
    mpn: "B760M-DS3H-AX-DDR4",
    upc: "889523037905",
    specs: {
      socket: "LGA1700",
      chipset: "B760",
      ramType: "DDR4",
      formFactor: "Micro ATX",
      m2Slots: 2,
      sataPorts: 4,
      hasWifi: true,
      hasFrontUsbCHeader: false,
      pcieVersion: "PCIe 4.0",
      biosSupportJson: { "Intel 12th": "supported", "Intel 13th": "supported", "Intel 14th": "supported" },
      maxRamGb: 128,
    },
    priceProfile: { current: 119, average: 132, low: 104, volatility: 10, retailerCount: 4 },
  },
  {
    id: "mobo-msi-b550-a-pro",
    category: "motherboard",
    brand: "MSI",
    model: "B550-A Pro",
    mpn: "B550-A-PRO",
    upc: "824142217538",
    specs: {
      socket: "AM4",
      chipset: "B550",
      ramType: "DDR4",
      formFactor: "ATX",
      m2Slots: 2,
      sataPorts: 6,
      hasWifi: false,
      hasFrontUsbCHeader: false,
      pcieVersion: "PCIe 4.0",
      biosSupportJson: { "Ryzen 3000": "supported", "Ryzen 5000": "supported" },
      maxRamGb: 128,
    },
    priceProfile: { current: 109, average: 124, low: 99, volatility: 9, retailerCount: 4 },
  },
  {
    id: "ram-gskill-flare-x5-32-ddr5-6000-cl30",
    category: "ram",
    brand: "G.Skill",
    model: "Flare X5 32GB DDR5-6000 CL30",
    mpn: "F5-6000J3038F16GX2-FX5",
    upc: "848354044067",
    specs: { ramType: "DDR5", capacityGb: 32, speedMt: 6000, casLatency: 30, sticks: 2, heightMm: 33 },
    priceProfile: { current: 96, average: 111, low: 89, volatility: 8, retailerCount: 5 },
  },
  {
    id: "ram-corsair-vengeance-32-ddr5-6000-cl30",
    category: "ram",
    brand: "Corsair",
    model: "Vengeance 32GB DDR5-6000 CL30",
    mpn: "CMK32GX5M2B6000C30",
    upc: "840006696115",
    specs: { ramType: "DDR5", capacityGb: 32, speedMt: 6000, casLatency: 30, sticks: 2, heightMm: 35 },
    priceProfile: { current: 104, average: 119, low: 94, volatility: 9, retailerCount: 5 },
  },
  {
    id: "ram-teamgroup-tcreate-32-ddr5-6000-cl30",
    category: "ram",
    brand: "TeamGroup",
    model: "T-Create Expert 32GB DDR5-6000 CL30",
    mpn: "CTCED532G6000HC30DC01",
    upc: "765441654329",
    specs: { ramType: "DDR5", capacityGb: 32, speedMt: 6000, casLatency: 30, sticks: 2, heightMm: 32 },
    priceProfile: { current: 93, average: 108, low: 86, volatility: 8, retailerCount: 4 },
  },
  {
    id: "ram-gskill-trident-z5-rgb-64-ddr5-6400-cl32",
    category: "ram",
    brand: "G.Skill",
    model: "Trident Z5 RGB 64GB DDR5-6400 CL32",
    mpn: "F5-6400J3239G32GX2-TZ5RK",
    upc: "848354045156",
    specs: { ramType: "DDR5", capacityGb: 64, speedMt: 6400, casLatency: 32, sticks: 2, heightMm: 44 },
    priceProfile: { current: 214, average: 234, low: 199, volatility: 16, retailerCount: 4 },
  },
  {
    id: "ram-kingston-fury-beast-32-ddr5-5600-cl36",
    category: "ram",
    brand: "Kingston",
    model: "Fury Beast 32GB DDR5-5600 CL36",
    mpn: "KF556C36BBEK2-32",
    upc: "740617333070",
    specs: { ramType: "DDR5", capacityGb: 32, speedMt: 5600, casLatency: 36, sticks: 2, heightMm: 34 },
    priceProfile: { current: 87, average: 101, low: 79, volatility: 7, retailerCount: 4 },
  },
  {
    id: "ram-crucial-pro-32-ddr5-6000-cl36",
    category: "ram",
    brand: "Crucial",
    model: "Pro 32GB DDR5-6000 CL36",
    mpn: "CP2K16G60C36U5B",
    upc: "649528939429",
    specs: { ramType: "DDR5", capacityGb: 32, speedMt: 6000, casLatency: 36, sticks: 2, heightMm: 35 },
    priceProfile: { current: 91, average: 104, low: 82, volatility: 7, retailerCount: 4 },
  },
  {
    id: "ram-corsair-lpx-32-ddr4-3600-cl18",
    category: "ram",
    brand: "Corsair",
    model: "Vengeance LPX 32GB DDR4-3600 CL18",
    mpn: "CMK32GX4M2D3600C18",
    upc: "840006609891",
    specs: { ramType: "DDR4", capacityGb: 32, speedMt: 3600, casLatency: 18, sticks: 2, heightMm: 34 },
    priceProfile: { current: 67, average: 79, low: 58, volatility: 6, retailerCount: 5 },
  },
  {
    id: "ram-gskill-ripjaws-v-16-ddr4-3200-cl16",
    category: "ram",
    brand: "G.Skill",
    model: "Ripjaws V 16GB DDR4-3200 CL16",
    mpn: "F4-3200C16D-16GVKB",
    upc: "848354026604",
    specs: { ramType: "DDR4", capacityGb: 16, speedMt: 3200, casLatency: 16, sticks: 2, heightMm: 42 },
    priceProfile: { current: 39, average: 47, low: 34, volatility: 4, retailerCount: 4 },
  },
  {
    id: "storage-samsung-990-evo-plus-1tb",
    category: "storage",
    brand: "Samsung",
    model: "990 EVO Plus 1TB NVMe SSD",
    mpn: "MZ-V9S1T0B/AM",
    upc: "887276840838",
    specs: { type: "SSD", capacityGb: 1000, interface: "PCIe 4.0 x4 NVMe", formFactor: "M.2 2280" },
    priceProfile: { current: 79, average: 92, low: 69, volatility: 7, retailerCount: 5 },
  },
  {
    id: "storage-wd-black-sn850x-2tb",
    category: "storage",
    brand: "Western Digital",
    model: "Black SN850X 2TB NVMe SSD",
    mpn: "WDS200T2X0E",
    upc: "718037891408",
    specs: { type: "SSD", capacityGb: 2000, interface: "PCIe 4.0 x4 NVMe", formFactor: "M.2 2280" },
    priceProfile: { current: 139, average: 159, low: 119, volatility: 12, retailerCount: 5 },
  },
  {
    id: "storage-crucial-p3-plus-1tb",
    category: "storage",
    brand: "Crucial",
    model: "P3 Plus 1TB NVMe SSD",
    mpn: "CT1000P3PSSD8",
    upc: "649528918802",
    specs: { type: "SSD", capacityGb: 1000, interface: "PCIe 4.0 x4 NVMe", formFactor: "M.2 2280" },
    priceProfile: { current: 62, average: 72, low: 54, volatility: 6, retailerCount: 5 },
  },
  {
    id: "storage-solidigm-p44-pro-2tb",
    category: "storage",
    brand: "Solidigm",
    model: "P44 Pro 2TB NVMe SSD",
    mpn: "SSDPFKKW020X7X1",
    upc: "840307300192",
    specs: { type: "SSD", capacityGb: 2000, interface: "PCIe 4.0 x4 NVMe", formFactor: "M.2 2280" },
    priceProfile: { current: 128, average: 149, low: 119, volatility: 11, retailerCount: 4 },
  },
  {
    id: "storage-samsung-990-pro-2tb",
    category: "storage",
    brand: "Samsung",
    model: "990 Pro 2TB NVMe SSD",
    mpn: "MZ-V9P2T0B/AM",
    upc: "887276657486",
    specs: { type: "SSD", capacityGb: 2000, interface: "PCIe 4.0 x4 NVMe", formFactor: "M.2 2280" },
    priceProfile: { current: 159, average: 181, low: 139, volatility: 14, retailerCount: 5 },
  },
  {
    id: "storage-kingston-nv3-1tb",
    category: "storage",
    brand: "Kingston",
    model: "NV3 1TB NVMe SSD",
    mpn: "SNV3S/1000G",
    upc: "740617344649",
    specs: { type: "SSD", capacityGb: 1000, interface: "PCIe 4.0 x4 NVMe", formFactor: "M.2 2280" },
    priceProfile: { current: 55, average: 64, low: 48, volatility: 5, retailerCount: 4 },
  },
  {
    id: "storage-wd-blue-sn580-2tb",
    category: "storage",
    brand: "Western Digital",
    model: "Blue SN580 2TB NVMe SSD",
    mpn: "WDS200T3B0E",
    upc: "718037903224",
    specs: { type: "SSD", capacityGb: 2000, interface: "PCIe 4.0 x4 NVMe", formFactor: "M.2 2280" },
    priceProfile: { current: 113, average: 132, low: 99, volatility: 10, retailerCount: 4 },
  },
  {
    id: "storage-crucial-mx500-1tb",
    category: "storage",
    brand: "Crucial",
    model: "MX500 1TB SATA SSD",
    mpn: "CT1000MX500SSD1",
    upc: "649528785145",
    specs: { type: "SSD", capacityGb: 1000, interface: "SATA 6Gb/s", formFactor: "2.5-inch" },
    priceProfile: { current: 74, average: 86, low: 62, volatility: 7, retailerCount: 4 },
  },
  {
    id: "psu-corsair-rm650e",
    category: "psu",
    brand: "Corsair",
    model: "RM650e 650W Gold ATX 3.0",
    mpn: "CP-9020262-NA",
    upc: "840006695699",
    specs: {
      wattage: 650,
      efficiency: "80+ Gold",
      formFactor: "ATX",
      has12vhpwr: true,
      has12v2x6: false,
      pcie8PinCount: 2,
      qualityTier: "A",
    },
    priceProfile: { current: 89, average: 104, low: 79, volatility: 8, retailerCount: 5 },
  },
  {
    id: "psu-corsair-rm750e",
    category: "psu",
    brand: "Corsair",
    model: "RM750e 750W Gold ATX 3.0",
    mpn: "CP-9020263-NA",
    upc: "840006695705",
    specs: {
      wattage: 750,
      efficiency: "80+ Gold",
      formFactor: "ATX",
      has12vhpwr: true,
      has12v2x6: false,
      pcie8PinCount: 3,
      qualityTier: "A",
    },
    priceProfile: { current: 99, average: 119, low: 89, volatility: 9, retailerCount: 5 },
  },
  {
    id: "psu-seasonic-focus-gx-750-atx3",
    category: "psu",
    brand: "Seasonic",
    model: "Focus GX-750 ATX 3.0",
    mpn: "FOCUS-GX-750-ATX30",
    upc: "4711173878174",
    specs: {
      wattage: 750,
      efficiency: "80+ Gold",
      formFactor: "ATX",
      has12vhpwr: true,
      has12v2x6: true,
      pcie8PinCount: 3,
      qualityTier: "A",
    },
    priceProfile: { current: 118, average: 134, low: 104, volatility: 10, retailerCount: 4 },
  },
  {
    id: "psu-bequiet-pure-power-12m-850",
    category: "psu",
    brand: "be quiet!",
    model: "Pure Power 12 M 850W Gold",
    mpn: "BN506",
    upc: "4260052189461",
    specs: {
      wattage: 850,
      efficiency: "80+ Gold",
      formFactor: "ATX",
      has12vhpwr: true,
      has12v2x6: false,
      pcie8PinCount: 4,
      qualityTier: "A",
    },
    priceProfile: { current: 129, average: 149, low: 119, volatility: 11, retailerCount: 4 },
  },
  {
    id: "psu-msi-mag-a850gl-pcie5",
    category: "psu",
    brand: "MSI",
    model: "MAG A850GL PCIE5 850W Gold",
    mpn: "MAG-A850GL-PCIE5",
    upc: "824142305151",
    specs: {
      wattage: 850,
      efficiency: "80+ Gold",
      formFactor: "ATX",
      has12vhpwr: true,
      has12v2x6: false,
      pcie8PinCount: 4,
      qualityTier: "B",
    },
    priceProfile: { current: 109, average: 128, low: 99, volatility: 10, retailerCount: 5 },
  },
  {
    id: "psu-thermaltake-gf-a3-750",
    category: "psu",
    brand: "Thermaltake",
    model: "Toughpower GF A3 750W Gold",
    mpn: "PS-TPD-0750FNFAGU-L",
    upc: "841163090878",
    specs: {
      wattage: 750,
      efficiency: "80+ Gold",
      formFactor: "ATX",
      has12vhpwr: true,
      has12v2x6: true,
      pcie8PinCount: 3,
      qualityTier: "B",
    },
    priceProfile: { current: 94, average: 112, low: 84, volatility: 9, retailerCount: 4 },
  },
  {
    id: "psu-evga-650-bq",
    category: "psu",
    brand: "EVGA",
    model: "650 BQ Bronze",
    mpn: "110-BQ-0650-V1",
    upc: "843368043103",
    specs: {
      wattage: 650,
      efficiency: "80+ Bronze",
      formFactor: "ATX",
      has12vhpwr: false,
      has12v2x6: false,
      pcie8PinCount: 4,
      qualityTier: "C",
    },
    priceProfile: { current: 64, average: 76, low: 54, volatility: 6, retailerCount: 4 },
  },
  {
    id: "psu-apevia-prestige-800",
    category: "psu",
    brand: "Apevia",
    model: "Prestige 800W Gold",
    mpn: "ATX-PR800W",
    upc: "810025062126",
    specs: {
      wattage: 800,
      efficiency: "80+ Gold",
      formFactor: "ATX",
      has12vhpwr: false,
      has12v2x6: false,
      pcie8PinCount: 4,
      qualityTier: "D",
    },
    priceProfile: { current: 59, average: 72, low: 49, volatility: 8, retailerCount: 3 },
  },
  {
    id: "case-lian-li-lancool-216",
    category: "case",
    brand: "Lian Li",
    model: "Lancool 216 Airflow",
    mpn: "G99.LAN216X.00",
    upc: "840353044832",
    specs: {
      formFactorSupport: ["ATX", "Micro ATX", "Mini ITX", "E-ATX"],
      maxGpuLengthMm: 392,
      maxCpuCoolerHeightMm: 180,
      radiatorSupport: [240, 280, 360],
      hasFrontUsbC: true,
      includedFans: 2,
      airflowScore: 95,
    },
    priceProfile: { current: 99, average: 119, low: 89, volatility: 10, retailerCount: 5 },
  },
  {
    id: "case-fractal-pop-air",
    category: "case",
    brand: "Fractal Design",
    model: "Pop Air",
    mpn: "FD-C-POA1A-02",
    upc: "843276104832",
    specs: {
      formFactorSupport: ["ATX", "Micro ATX", "Mini ITX"],
      maxGpuLengthMm: 405,
      maxCpuCoolerHeightMm: 170,
      radiatorSupport: [240, 280],
      hasFrontUsbC: false,
      includedFans: 3,
      airflowScore: 85,
    },
    priceProfile: { current: 79, average: 94, low: 69, volatility: 8, retailerCount: 4 },
  },
  {
    id: "case-nzxt-h5-flow-2024",
    category: "case",
    brand: "NZXT",
    model: "H5 Flow 2024",
    mpn: "CC-H52FB-01",
    upc: "810074844994",
    specs: {
      formFactorSupport: ["ATX", "Micro ATX", "Mini ITX"],
      maxGpuLengthMm: 410,
      maxCpuCoolerHeightMm: 175,
      radiatorSupport: [240, 280, 360],
      hasFrontUsbC: true,
      includedFans: 2,
      airflowScore: 82,
    },
    priceProfile: { current: 94, average: 109, low: 84, volatility: 9, retailerCount: 4 },
  },
  {
    id: "case-corsair-4000d-airflow",
    category: "case",
    brand: "Corsair",
    model: "4000D Airflow",
    mpn: "CC-9011200-WW",
    upc: "840006621829",
    specs: {
      formFactorSupport: ["ATX", "Micro ATX", "Mini ITX"],
      maxGpuLengthMm: 360,
      maxCpuCoolerHeightMm: 170,
      radiatorSupport: [240, 280, 360],
      hasFrontUsbC: true,
      includedFans: 2,
      airflowScore: 88,
    },
    priceProfile: { current: 89, average: 105, low: 79, volatility: 9, retailerCount: 5 },
  },
  {
    id: "case-phanteks-xt-pro-ultra",
    category: "case",
    brand: "Phanteks",
    model: "XT Pro Ultra",
    mpn: "PH-XT523P1_DBK01",
    upc: "886523303484",
    specs: {
      formFactorSupport: ["ATX", "Micro ATX", "Mini ITX", "E-ATX"],
      maxGpuLengthMm: 415,
      maxCpuCoolerHeightMm: 184,
      radiatorSupport: [240, 360],
      hasFrontUsbC: true,
      includedFans: 4,
      airflowScore: 90,
    },
    priceProfile: { current: 74, average: 89, low: 69, volatility: 7, retailerCount: 4 },
  },
  {
    id: "case-montech-air-903-base",
    category: "case",
    brand: "Montech",
    model: "Air 903 Base",
    mpn: "AIR-903-BASE-B",
    upc: "4710562747208",
    specs: {
      formFactorSupport: ["ATX", "Micro ATX", "Mini ITX", "E-ATX"],
      maxGpuLengthMm: 400,
      maxCpuCoolerHeightMm: 180,
      radiatorSupport: [240, 360],
      hasFrontUsbC: true,
      includedFans: 3,
      airflowScore: 91,
    },
    priceProfile: { current: 65, average: 78, low: 59, volatility: 6, retailerCount: 4 },
  },
  {
    id: "case-cooler-master-q300l-v2",
    category: "case",
    brand: "Cooler Master",
    model: "Q300L V2",
    mpn: "MCB-Q300L-KANN-S02",
    upc: "884102112660",
    specs: {
      formFactorSupport: ["Micro ATX", "Mini ITX"],
      maxGpuLengthMm: 360,
      maxCpuCoolerHeightMm: 159,
      radiatorSupport: [240],
      hasFrontUsbC: false,
      includedFans: 1,
      airflowScore: 65,
    },
    priceProfile: { current: 54, average: 63, low: 45, volatility: 5, retailerCount: 4 },
  },
  {
    id: "case-fractal-terra",
    category: "case",
    brand: "Fractal Design",
    model: "Terra Mini-ITX",
    mpn: "FD-C-TER1N-03",
    upc: "843276104955",
    specs: {
      formFactorSupport: ["Mini ITX"],
      maxGpuLengthMm: 322,
      maxCpuCoolerHeightMm: 77,
      radiatorSupport: [],
      hasFrontUsbC: true,
      includedFans: 0,
      airflowScore: 70,
    },
    priceProfile: { current: 179, average: 194, low: 159, volatility: 14, retailerCount: 3 },
  },
  {
    id: "cooler-thermalright-peerless-assassin-120-se",
    category: "cooler",
    brand: "Thermalright",
    model: "Peerless Assassin 120 SE",
    mpn: "PA120SE",
    upc: "814256018020",
    specs: {
      type: "air",
      supportedSockets: ["AM4", "AM5", "LGA1700"],
      heightMm: 155,
      tdpRating: 220,
      ramClearanceIssue: true,
    },
    priceProfile: { current: 34, average: 41, low: 31, volatility: 4, retailerCount: 5 },
  },
  {
    id: "cooler-thermalright-phantom-spirit-120-evo",
    category: "cooler",
    brand: "Thermalright",
    model: "Phantom Spirit 120 EVO",
    mpn: "PS120EVO",
    upc: "814256018518",
    specs: {
      type: "air",
      supportedSockets: ["AM4", "AM5", "LGA1700"],
      heightMm: 157,
      tdpRating: 240,
      ramClearanceIssue: true,
    },
    priceProfile: { current: 48, average: 56, low: 42, volatility: 5, retailerCount: 4 },
  },
  {
    id: "cooler-deepcool-ak400",
    category: "cooler",
    brand: "DeepCool",
    model: "AK400",
    mpn: "R-AK400-BKNNMN-G-1",
    upc: "6933412727443",
    specs: {
      type: "air",
      supportedSockets: ["AM4", "AM5", "LGA1700"],
      heightMm: 155,
      tdpRating: 180,
      ramClearanceIssue: false,
    },
    priceProfile: { current: 29, average: 36, low: 27, volatility: 4, retailerCount: 4 },
  },
  {
    id: "cooler-bequiet-pure-rock-2",
    category: "cooler",
    brand: "be quiet!",
    model: "Pure Rock 2",
    mpn: "BK006",
    upc: "4260052187955",
    specs: {
      type: "air",
      supportedSockets: ["AM4", "AM5", "LGA1700"],
      heightMm: 155,
      tdpRating: 150,
      ramClearanceIssue: false,
    },
    priceProfile: { current: 39, average: 47, low: 35, volatility: 4, retailerCount: 4 },
  },
  {
    id: "cooler-noctua-nh-d15-g2",
    category: "cooler",
    brand: "Noctua",
    model: "NH-D15 G2",
    mpn: "NH-D15-G2",
    upc: "9010018000573",
    specs: {
      type: "air",
      supportedSockets: ["AM4", "AM5", "LGA1700"],
      heightMm: 168,
      tdpRating: 250,
      ramClearanceIssue: true,
    },
    priceProfile: { current: 149, average: 159, low: 139, volatility: 9, retailerCount: 3 },
  },
  {
    id: "cooler-cooler-master-hyper-212-black",
    category: "cooler",
    brand: "Cooler Master",
    model: "Hyper 212 Black",
    mpn: "RR-S4KK-25SN-R1",
    upc: "884102118075",
    specs: {
      type: "air",
      supportedSockets: ["AM4", "AM5", "LGA1700"],
      heightMm: 158,
      tdpRating: 150,
      ramClearanceIssue: false,
    },
    priceProfile: { current: 36, average: 44, low: 29, volatility: 5, retailerCount: 4 },
  },
  {
    id: "cooler-arctic-liquid-freezer-iii-240",
    category: "cooler",
    brand: "ARCTIC",
    model: "Liquid Freezer III 240",
    mpn: "ACFRE00134A",
    upc: "4895213704528",
    specs: {
      type: "aio",
      supportedSockets: ["AM4", "AM5", "LGA1700"],
      radiatorSizeMm: 240,
      tdpRating: 280,
      ramClearanceIssue: false,
    },
    priceProfile: { current: 86, average: 101, low: 77, volatility: 8, retailerCount: 4 },
  },
  {
    id: "cooler-corsair-nautilus-240-rs",
    category: "cooler",
    brand: "Corsair",
    model: "Nautilus 240 RS AIO",
    mpn: "CW-9061017-WW",
    upc: "840006697136",
    specs: {
      type: "aio",
      supportedSockets: ["AM4", "AM5", "LGA1700"],
      radiatorSizeMm: 240,
      tdpRating: 260,
      ramClearanceIssue: false,
    },
    priceProfile: { current: 92, average: 112, low: 84, volatility: 9, retailerCount: 4 },
  },
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function roundPrice(value: number) {
  return Math.max(0, Math.round(value * 100) / 100);
}

function priceForDay(product: ProductSeed, dayIndex: number) {
  const { average, low, current, volatility } = product.priceProfile;
  if (dayIndex === 179) {
    return current;
  }

  const trend = ((current - average) * dayIndex) / 179;
  const seasonalWave = Math.sin((dayIndex / 180) * Math.PI * 5 + product.id.length) * volatility;
  const weeklyNoise = Math.cos((dayIndex / 13) * Math.PI + product.model.length) * (volatility / 2);
  const promoDip = dayIndex % 47 === product.id.length % 47 ? -volatility * 1.35 : 0;
  const price = average + trend + seasonalWave + weeklyNoise + promoDip;

  return roundPrice(Math.max(low, price));
}

function trustedOfferPrice(product: ProductSeed) {
  return roundPrice(product.priceProfile.current);
}

function openBoxOfferPrice(product: ProductSeed) {
  return roundPrice(product.priceProfile.current * 0.92);
}

function suspiciousUsedOfferPrice(product: ProductSeed) {
  return roundPrice(product.priceProfile.current * 0.78);
}

function taxFor(price: number) {
  return roundPrice(price * 0.066);
}

function shippingFor(product: ProductSeed, price: number) {
  if (price >= 99) return 0;
  return product.category === "case" ? 14.99 : 6.99;
}

async function main() {
  await prisma.priceSnapshot.deleteMany();
  await prisma.dailyProductPrice.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.savedBuild.deleteMany();
  await prisma.product.deleteMany();

  for (const product of products) {
    await prisma.product.create({
      data: {
        id: product.id,
        category: product.category,
        brand: product.brand,
        model: product.model,
        normalizedName: normalize(`${product.brand} ${product.model}`),
        mpn: product.mpn,
        upc: product.upc,
        specsJson: JSON.stringify(product.specs),
      },
    });
  }

  const offers = products.flatMap((product, index) => {
    const trustedPrice = trustedOfferPrice(product);
    const openBoxPrice = openBoxOfferPrice(product);
    const usedPrice = suspiciousUsedOfferPrice(product);
    const safeRetailers = ["Amazon", "Newegg", "Best Buy", "Micro Center"];
    const retailer = safeRetailers[index % safeRetailers.length];
    const hasExtraUsedListing = product.category === "gpu" || product.category === "cpu" || product.category === "motherboard";

    return [
      {
        id: `offer-${product.id}-new`,
        productId: product.id,
        retailer,
        title: `${product.brand} ${product.model}`,
        url: `https://example.com/${retailer.toLowerCase().replace(/\s+/g, "-")}/${product.id}`,
        price: trustedPrice,
        shipping: shippingFor(product, trustedPrice),
        taxEstimate: taxFor(trustedPrice),
        condition: "new",
        sellerName: retailer,
        sellerRating: 4.8,
        inStock: true,
        confidenceScore: 0.96,
        lastCheckedAt: anchorDate,
      },
      {
        id: `offer-${product.id}-open-box`,
        productId: product.id,
        retailer: "Micro Center",
        title: `Open box ${product.brand} ${product.model}`,
        url: `https://example.com/micro-center/open-box/${product.id}`,
        price: openBoxPrice,
        shipping: product.category === "case" ? 14.99 : 0,
        taxEstimate: taxFor(openBoxPrice),
        condition: "open_box",
        sellerName: "Micro Center",
        sellerRating: 4.6,
        inStock: index % 5 !== 0,
        confidenceScore: 0.84,
        lastCheckedAt: anchorDate,
      },
      ...(hasExtraUsedListing
        ? [
            {
              id: `offer-${product.id}-used-risky`,
              productId: product.id,
              retailer: "eBay",
              title: `${product.model} used no box as-is`,
              url: `https://example.com/ebay/${product.id}`,
              price: usedPrice,
              shipping: 12.99,
              taxEstimate: taxFor(usedPrice),
              condition: "used",
              sellerName: "parts-bin-direct",
              sellerRating: 3.7,
              inStock: true,
              confidenceScore: 0.48,
              lastCheckedAt: anchorDate,
            },
          ]
        : []),
    ];
  });

  for (const offer of offers) {
    await prisma.offer.create({ data: offer });
  }

  const dailyRows = [];
  const snapshotRows = [];

  for (const product of products) {
    for (let dayIndex = 0; dayIndex < 180; dayIndex += 1) {
      const date = addDays(anchorDate, dayIndex - 179);
      date.setUTCHours(0, 0, 0, 0);

      const minNewPrice = priceForDay(product, dayIndex);
      const minOpenBoxPrice = roundPrice(minNewPrice * 0.93);
      const avgNewPrice = roundPrice(minNewPrice * 1.08 + product.priceProfile.volatility * 0.25);
      const lowestTrustedPrice = roundPrice(Math.min(minNewPrice, avgNewPrice * 0.96));

      dailyRows.push({
        productId: product.id,
        date,
        minNewPrice,
        minOpenBoxPrice,
        avgNewPrice,
        lowestTrustedPrice,
        retailerCount: product.priceProfile.retailerCount,
      });

      snapshotRows.push({
        productId: product.id,
        offerId: `offer-${product.id}-new`,
        retailer: "Seeded Retailer Index",
        price: minNewPrice,
        shipping: shippingFor(product, minNewPrice),
        taxEstimate: taxFor(minNewPrice),
        condition: "new",
        inStock: dayIndex % 29 !== 0,
        sellerName: "Seeded Retailer Index",
        sellerRating: 4.7,
        timestamp: date,
      });
    }
  }

  const batchSize = 500;
  for (let index = 0; index < dailyRows.length; index += batchSize) {
    await prisma.dailyProductPrice.createMany({ data: dailyRows.slice(index, index + batchSize) });
  }

  for (let index = 0; index < snapshotRows.length; index += batchSize) {
    await prisma.priceSnapshot.createMany({ data: snapshotRows.slice(index, index + batchSize) });
  }

  await prisma.savedBuild.create({
    data: {
      id: "saved-build-balanced-1440p",
      name: "Seeded Balanced 1440p Build",
      targetBudget: 1500,
      useCase: "gaming",
      resolution: "1440p",
      partsJson: JSON.stringify({
        cpu: "cpu-ryzen-5-7600",
        gpu: "gpu-rx-7800-xt",
        motherboard: "mobo-gigabyte-b650-eagle-ax",
        ram: "ram-gskill-flare-x5-32-ddr5-6000-cl30",
        storage: "storage-wd-black-sn850x-2tb",
        psu: "psu-corsair-rm750e",
        case: "case-lian-li-lancool-216",
        cooler: "cooler-thermalright-peerless-assassin-120-se",
      }),
      totalPrice: 1378,
      compatibilityStatus: "PASS",
      dealScore: 86,
    },
  });

  const counts = await prisma.product.groupBy({
    by: ["category"],
    _count: { id: true },
  });

  console.table(counts.map((count) => ({ category: count.category, products: count._count.id })));
  console.log(`Seeded ${offers.length} offers and ${dailyRows.length} daily price rows.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
