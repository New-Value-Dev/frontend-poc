import type { MetadataRoute } from "next";

/**
 * PWA 매니페스트. Turbopack에서 `next-pwa`가 동작하지 않으므로 매니페스트와
 * 서비스워커를 직접 관리한다
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NV 사이드 프로젝트",
    short_name: "NV",
    description: "프로젝트별 문서를 통합 관리하고 GPT/RAG로 검색/분석하는 AI 문서 플랫폼",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "ko",
    background_color: "#ffffff",
    theme_color: "#b01c2e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
