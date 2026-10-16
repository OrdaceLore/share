import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'乐换 — 用一首喜欢，遇见三首未知',description:'分享你的心头好，交换三首新音乐。让每一次喜欢，都找到回响。'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
