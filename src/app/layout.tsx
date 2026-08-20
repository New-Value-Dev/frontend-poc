import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { AppChrome } from "@/components/layout/AppChrome";
import { AuthProvider } from "@/components/auth/AuthProvider";

/** 한글 UI 전용 가변 폰트. Geist는 라틴 전용이라 한글은 시스템 기본 고딕으로 폴백되어 톤이 어긋났다. */
const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
  fallback: ["Apple SD Gothic Neo", "Malgun Gothic", "system-ui", "sans-serif"],
});

/** 숫자/영문 표기(tnum 등)에는 계속 Geist Mono를 쓴다. */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "사이드 프로젝트",
  description: "프로젝트별 문서를 통합 관리하고 GPT/RAG로 검색/분석하는 AI 문서 플랫폼",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${pretendard.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AuthProvider>
          <AppChrome>{children}</AppChrome>
        </AuthProvider>
      </body>
    </html>
  );
}
