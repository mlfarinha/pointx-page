// The paper's numbers, transcribed from its tables (tabs/surface.tex, consistency.tex, perview.tex, ablation.tex) and from the
// runs behind its more-views figure. null = the method does not predict the property. One source for charts and tables.
const U = "up", D = "down";
const m = (label, dir, digits, unit = "") => ({ label, dir, digits, unit });

export const METHODS = {
  gt: { label: "Ground-truth maps", kind: "ref", chart: false },
  iid: { label: "Intrinsic Image Diffusion", short: "Intrinsic Image Diff.", group: "Single-view" },
  rgbx: { label: "RGB↔X", group: "Single-view" },
  marigold: { label: "Marigold V2", group: "Single-view" },
  dr: { label: "DiffusionRenderer", group: "Video" },
  vrgbx: { label: "V-RGBX", group: "Video" },
  unid: { label: "UniD", group: "Video" },
  mvi: { label: "MVInverse", group: "Multi-view" },
  geoid: { label: "RGB↔X + GeoID", group: "Multi-view" },
  nopool: { label: "PointX w/o pooling", kind: "variant" },
  ours: { label: "PointX (Ours)", kind: "ours" },
  ours_vggt: { label: "PointX · VGGT-Ω tracks", short: "PointX · VGGT-Ω", kind: "ours" },
  ours_roma: { label: "PointX · RoMa-Ω tracks", short: "PointX · RoMa-Ω", kind: "ours" },
  ours_gt: { label: "PointX · ground-truth tracks", short: "PointX · GT tracks", kind: "ref" },
  no_geo: { label: "w/o input geometry", kind: "variant" },
  no_global: { label: "w/o global attention", kind: "variant" },
};

const _ = null;
export const TABLES = [
  {
    id: "surface", tab: "Surface points", table: "Table 1",
    lede: "The geometry of the scene is given and its surface points are queried directly. Baselines predict one map per view, so their maps are read at each point's projections and averaged; PointX answers once per point.",
    blocks: [
      {
        id: "hypersim", label: "Hypersim",
        metrics: [m("Albedo PSNR", U, 2, "dB"), m("Albedo PSNRₛ", U, 2, "dB"), m("Irradiance PSNRₛ", U, 2, "dB"), m("Normal error", D, 1, "°"),
          m("Albedo RMSEᵣ", D, 3), m("Irradiance RMSEᵣ", D, 3), m("Normal angle", D, 1, "°")],
        groups: [["Accuracy of the point's prediction", 4], ["Disagreement between views, before averaging", 3]],
        rows: [
          ["gt", [36.59, 36.62, 35.52, 1.8, 0.083, 0.142, 4.7]],
          ["iid", [12.35, 14.18, _, _, 0.482, _, _]],
          ["rgbx", [23.94, 24.65, 23.90, 8.5, 0.193, 0.297, 8.1], "seen"],
          ["dr", [14.42, 16.73, _, 13.9, 0.309, _, 12.0]],
          ["vrgbx", [12.05, 15.58, 18.96, 23.6, 0.235, 0.330, 11.6]],
          ["mvi", [18.40, 25.53, 19.29, 8.7, 0.137, 0.349, 6.2]],
          ["geoid", [23.47, 24.37, _, _, 0.184, _, _], "seen"],
          ["unid", [17.27, 18.51, 20.64, 15.3, 0.187, 0.309, 10.9]],
          ["marigold", [21.18, 22.56, _, 8.8, 0.206, _, 5.7]],
          ["nopool", [20.25, 22.57, 22.48, 9.1, 0.132, 0.213, 3.9]],
          ["ours", [20.23, 22.55, 22.46, 8.8, 0, 0, 0], "zero"],
        ],
      },
      {
        id: "interiorverse", label: "InteriorVerse",
        metrics: [m("Albedo PSNR", U, 2, "dB"), m("Albedo PSNRₛ", U, 2, "dB"), m("Normal error", D, 1, "°"), m("Roughness RMSE", D, 3), m("Metallicity RMSE", D, 3),
          m("Albedo RMSEᵣ", D, 3), m("Normal angle", D, 1, "°"), m("Roughness RMSEᵣ", D, 3), m("Metallicity RMSEᵣ", D, 3)],
        groups: [["Accuracy of the point's prediction", 5], ["Disagreement between views, before averaging", 4]],
        rows: [
          ["gt", [36.14, 36.15, 1.5, 0.017, 0.021, 0.081, 2.6, 0.075, 0.159]],
          ["iid", [16.17, 19.15, _, 0.200, 0.129, 0.428, _, 0.550, 0.486]],
          ["rgbx", [9.65, 19.01, 12.2, 0.303, 0.410, 0.481, 17.3, 0.579, 0.839]],
          ["dr", [10.89, 17.88, 11.3, 0.286, 0.185, 0.491, 13.0, 0.811, 0.952]],
          ["vrgbx", [11.54, 14.62, 21.9, 0.405, 0.186, 0.402, 15.2, 0.780, 0.957]],
          ["mvi", [18.77, 19.61, 7.9, 0.153, 0.107, 0.194, 8.1, 0.225, 0.283]],
          ["geoid", [10.99, 19.14, _, 0.266, 0.422, 0.459, _, 0.543, 0.813]],
          ["unid", [9.89, 16.45, 15.5, _, _, 0.320, 16.9, _, _]],
          ["marigold", [11.68, 17.21, 8.7, _, _, 0.375, 9.7, _, _]],
          ["nopool", [25.42, 25.88, 5.8, 0.083, 0.072, 0.140, 4.2, 0.132, 0.220]],
          ["ours", [25.54, 26.01, 5.3, 0.083, 0.073, 0, 0, 0, 0], "zero"],
        ],
      },
    ],
    note: "PSNRₛ: PSNR after a per-channel scale. RMSEᵣ: RMSE between two views relative to randomly paired points (0 = the views agree, 1 = chance). The ground-truth maps go through the same protocol as a reference; PointX without pooling is a variant. Neither is ranked. † Trained on the Hypersim test scenes, not ranked there.",
  },
  {
    id: "consistency", tab: "Consistency", table: "Table 2",
    lede: "Only the images are given. Every method predicts one map per view of the real photographs of ETH3D, and the maps of two views are compared at exact, laser-scanned correspondences.",
    blocks: [
      {
        id: "eth3d", label: "ETH3D",
        metrics: [m("Albedo RMSEᵣ", D, 3), m("Irradiance RMSEᵣ", D, 3), m("Normal angle", D, 1, "°"), m("Roughness RMSEᵣ", D, 3), m("Metallicity RMSEᵣ", D, 3)],
        groups: [["Disagreement between two views at ground-truth correspondences", 5]],
        rows: [
          ["iid", [0.481, _, _, 0.759, 0.581]],
          ["rgbx", [0.378, 0.448, 13.5, 0.562, 0.799]],
          ["marigold", [0.210, _, 7.4, _, _]],
          ["dr", [0.291, _, 11.6, 0.568, 0.733]],
          ["vrgbx", [0.216, 0.302, 10.4, 0.334, 0.870]],
          ["mvi", [0.161, 0.318, 9.6, 0.382, 0.270]],
          ["geoid", [0.374, _, _, 0.556, 0.783]],
          ["unid", [0.200, 0.327, 11.1, _, _]],
          ["ours_vggt", [0.177, 0.214, 4.6, 0.217, 0.353]],
          ["ours_roma", [0.095, 0.146, 2.9, 0.136, 0.222]],
          ["ours_gt", [0.058, 0.079, 1.0, 0.078, 0.125]],
        ],
      },
    ],
    note: "PointX is listed once per source of tracks: projection through VGGT-Ω's estimated geometry, the dense matcher RoMa-Ω, or the ground-truth geometry (a reference, not ranked: it uses the scan at test time). No retraining between them.",
  },
  {
    id: "accuracy", tab: "Per-view accuracy", table: "Table 3",
    lede: "Accuracy of per-view maps on rendered scenes and on the real photographs of MAW, from one image and from several images of a scene.",
    settings: ["One image", "Several images (up to eight)"],
    blocks: [
      {
        id: "interiorverse", label: "InteriorVerse",
        metrics: [m("Albedo PSNR", U, 2, "dB"), m("Albedo PSNRₛ", U, 2, "dB"), m("Albedo LPIPS", D, 3), m("Normal error", D, 1, "°"), m("Roughness RMSE", D, 3), m("Metallicity RMSE", D, 3)],
        groups: [["Accuracy", 6]],
        rows: [[
          ["iid", [15.84, 19.02, 0.163, _, 0.211, 0.141]], ["rgbx", [9.78, 18.22, 0.320, 19.3, 0.317, 0.412]], ["dr", [13.36, 18.74, 0.281, 10.8, 0.281, 0.199]],
          ["vrgbx", [9.78, 15.57, 0.434, 20.7, 0.566, 0.197]], ["mvi", [18.02, 19.00, 0.177, 8.7, 0.155, 0.117]], ["unid", [8.74, 14.28, 0.351, 12.4, _, _]],
          ["marigold", [11.84, 17.27, 0.222, 9.7, _, _]], ["ours", [24.09, 24.87, 0.101, 6.3, 0.100, 0.085]],
        ], [
          ["dr", [10.92, 17.51, 0.365, 13.1, 0.293, 0.196]], ["vrgbx", [11.50, 14.41, 0.389, 24.1, 0.395, 0.197]], ["mvi", [18.50, 19.39, 0.173, 8.6, 0.152, 0.115]],
          ["geoid", [11.16, 18.27, 0.279, _, 0.277, 0.423]], ["unid", [9.99, 16.38, 0.318, 17.9, _, _]], ["ours", [25.13, 25.71, 0.103, 5.7, 0.084, 0.077]],
        ]],
      },
      {
        id: "hypersim", label: "Hypersim",
        metrics: [m("Albedo PSNR", U, 2, "dB"), m("Albedo PSNRₛ", U, 2, "dB"), m("Albedo LPIPS", D, 3), m("Irradiance PSNRₛ", U, 2, "dB"), m("Normal error", D, 1, "°")],
        groups: [["Accuracy", 5]],
        rows: [[
          ["iid", [11.67, 14.71, 0.455, _, _]], ["rgbx", [22.92, 24.07, 0.143, 23.90, 11.5], "seen"], ["dr", [12.64, 16.84, 0.385, _, 15.1]],
          ["vrgbx", [12.57, 16.06, 0.393, 17.88, 22.9]], ["mvi", [17.05, 24.28, 0.240, 19.17, 10.6]], ["unid", [17.11, 18.75, 0.352, 20.08, 14.3]],
          ["marigold", [19.90, 21.92, 0.220, _, 10.3]], ["ours", [18.87, 21.25, 0.192, 21.25, 12.3]],
        ], [
          ["dr", [13.85, 16.76, 0.379, _, 16.5]], ["vrgbx", [11.80, 16.03, 0.397, 18.23, 24.8]], ["mvi", [17.23, 24.61, 0.237, 19.19, 10.4]],
          ["geoid", [21.99, 23.59, 0.151, _, _], "seen"], ["unid", [16.51, 18.44, 0.426, 19.76, 17.3]], ["ours", [19.65, 22.02, 0.191, 21.42, 10.7]],
        ]],
      },
      {
        id: "maw", label: "MAW (real photographs)",
        metrics: [m("Albedo intensity ×10²", D, 2), m("Albedo chromaticity", D, 2), m("Albedo WHDR", D, 3)],
        groups: [["Error against measured albedo", 3]],
        rows: [[
          ["iid", [1.36, 4.16, 0.212]], ["rgbx", [0.70, 4.08, 0.219]], ["dr", [0.42, 3.44, 0.170]], ["vrgbx", [0.52, 4.67, 0.263]], ["mvi", [0.34, 3.93, 0.223]],
          ["unid", [0.36, 4.77, 0.229]], ["marigold", [0.24, 3.07, 0.233]], ["ours", [0.29, 3.10, 0.208]],
        ], [
          ["dr", [0.44, 3.56, 0.186]], ["vrgbx", [0.63, 4.94, 0.300]], ["mvi", [0.31, 3.82, 0.233]], ["geoid", [0.78, 3.90, 0.216]], ["unid", [0.41, 4.76, 0.237]], ["ours", [0.30, 2.87, 0.214]],
        ]],
      },
    ],
    note: "With several images, PointX uses RoMa-Ω tracks. No method was trained on MAW. † Trained on the Hypersim test scenes, not ranked there.",
  },
  {
    id: "ablations", tab: "Ablations", table: "Table 4",
    lede: "What each component contributes, on per-view maps with RoMa-Ω tracks.",
    blocks: [
      {
        id: "components", label: "Without one component", rankAll: true,
        metrics: [m("Albedo PSNR · 1 image", U, 2, "dB"), m("Albedo PSNR · 8 images", U, 2, "dB"), m("Normal error · 1 image", D, 2, "°"), m("Normal error · 8 images", D, 2, "°"),
          m("Albedo RMSEᵣ", D, 3), m("Normal angle", D, 2, "°"), m("Roughness RMSEᵣ", D, 3), m("Metallicity RMSEᵣ", D, 3)],
        groups: [["Accuracy on InteriorVerse", 4], ["Disagreement on ETH3D", 4]],
        rows: [
          ["ours", [24.09, 25.13, 6.29, 5.68, 0.095, 2.91, 0.136, 0.222]],
          ["nopool", [24.09, 25.12, 6.29, 5.65, 0.141, 5.24, 0.256, 0.355]],
          ["no_geo", [22.92, 23.83, 7.53, 7.10, 0.098, 3.09, 0.149, 0.278]],
          ["no_global", [23.90, 24.31, 6.22, 6.13, 0.118, 3.92, 0.248, 0.316]],
        ],
      },
    ],
    note: "Pooling brings consistency at no cost in accuracy: decoding every pixel from its own token is as accurate, but the views disagree far more. The variant without pooling is not retrained.",
  },
];

// Accuracy against consistency: one point per method. x = disagreement between views on ETH3D (Table 2), y = accuracy of per-view maps
// (Table 3; video and multi-view models with several images, single-view models with one).
export const TRADEOFF = {
  properties: [
    { id: "albedo", label: "Albedo", x: m("Disagreement between views on ETH3D · RMSEᵣ", D, 3), y: m("Albedo PSNR", U, 2, "dB") },
    { id: "normal", label: "Normal", x: m("Disagreement between views on ETH3D · mean angle", D, 1, "°"), y: m("Normal error", D, 1, "°") },
  ],
  datasets: [{ id: "interiorverse", label: "InteriorVerse" }, { id: "hypersim", label: "Hypersim" }],
  points: [
    // method, images, albedo x, normal x, {dataset: [albedo PSNR, normal error]}, seen-on
    ["iid", 1, 0.481, _, { interiorverse: [15.84, _], hypersim: [11.67, _] }],
    ["rgbx", 1, 0.378, 13.5, { interiorverse: [9.78, 19.3], hypersim: [22.92, 11.5] }, "hypersim"],
    ["marigold", 1, 0.210, 7.4, { interiorverse: [11.84, 9.7], hypersim: [19.90, 10.3] }],
    ["dr", 8, 0.291, 11.6, { interiorverse: [10.92, 13.1], hypersim: [13.85, 16.5] }],
    ["vrgbx", 8, 0.216, 10.4, { interiorverse: [11.50, 24.1], hypersim: [11.80, 24.8] }],
    ["mvi", 8, 0.161, 9.6, { interiorverse: [18.50, 8.6], hypersim: [17.23, 10.4] }],
    ["geoid", 8, 0.374, _, { interiorverse: [11.16, _], hypersim: [21.99, _] }, "hypersim"],
    ["unid", 8, 0.200, 11.1, { interiorverse: [9.99, 17.9], hypersim: [16.51, 17.3] }],
    ["ours", 8, 0.095, 2.9, { interiorverse: [25.13, 5.7], hypersim: [19.65, 10.7] }],
  ],
};

// More views (the paper's Fig. 5, InteriorVerse): the mean per-view error when every view is predicted from N images.
export const VIEWS = {
  n: [1, 2, 4, 8],
  panels: [
    { label: "Albedo", unit: "RMSE", ours: [0.0669, 0.0634, 0.0604, 0.0586], nopool: [0.0669, 0.0636, 0.0608, 0.0589], mvi: [0.1356, 0.1326, 0.1303, 0.1283] },
    { label: "Normal", unit: "°", ours: [6.2940, 6.0888, 5.8308, 5.6774], nopool: [6.2940, 6.0828, 5.8199, 5.6497], mvi: [8.7225, 8.6645, 8.6305, 8.6193] },
    { label: "Roughness", unit: "RMSE", ours: [0.1001, 0.0939, 0.0887, 0.0836], nopool: [0.1001, 0.0941, 0.0892, 0.0843], mvi: [0.1554, 0.1536, 0.1527, 0.1518] },
    { label: "Metallicity", unit: "RMSE", ours: [0.0854, 0.0819, 0.0787, 0.0769], nopool: [0.0854, 0.0819, 0.0786, 0.0764], mvi: [0.1174, 0.1164, 0.1155, 0.1148] },
  ],
};
