// 'use client'; ❌ 절대 넣지 마 (서버 컴포넌트)

import ClientPage from './ClientPage';

export const dynamicParams = false;

export default function Page() {
  return <ClientPage />;
}
