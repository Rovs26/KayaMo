'use client';

import { FoodHistory } from '@kayamo/features';

export function FoodHistoryClient({ userId }: { userId: string }) {
  return <FoodHistory userId={userId} />;
}
