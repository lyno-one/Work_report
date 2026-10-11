import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LYNO | Báo cáo công việc",
  description: "Demo hệ thống báo cáo công việc với phân quyền Admin, Manager và Employee.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
