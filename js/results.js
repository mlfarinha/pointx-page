// The Results section: the DL3DV video comparisons (and, below them, the surface-point comparisons).
import { mountVideoCompare } from "./compare.js";

const videos = document.getElementById("video-compare");
if (videos) fetch("assets/videos/index.json", { cache: "no-cache" }).then(r => r.json()).then(m => { window.pointxVideos = mountVideoCompare(videos, m, "assets/videos/"); })
  .catch(() => { videos.textContent = "The video comparisons could not be loaded."; });
