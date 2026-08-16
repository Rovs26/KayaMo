import type { Metadata } from 'next';
import { Gallery } from './gallery';

export const metadata: Metadata = {
  title: 'Design system · KayaMo',
};

export default function DesignSystemPage() {
  return <Gallery />;
}
