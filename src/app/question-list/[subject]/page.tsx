import dynamic from 'next/dynamic';

// 👇 이 줄이 핵심!
export const dynamicParams = false;

const ClientPage = dynamic(() => import('./ClientPage'), { ssr: false });

export default function Page() {
  return <ClientPage />;
}
