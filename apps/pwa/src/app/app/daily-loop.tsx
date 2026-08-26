'use client';

import { DailyLoop as DailyLoopView } from '@kayamo/features';
import { isNativeApp, registerPushIfNative } from '@kayamo/mobile/native';

export function DailyLoop({ userId }: { userId: string }) {
  return (
    <DailyLoopView
      userId={userId}
      native={{ isNativeApp, registerPushIfNative }}
    />
  );
}
