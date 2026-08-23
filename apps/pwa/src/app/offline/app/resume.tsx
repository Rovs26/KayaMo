'use client';

import { useEffect, useState } from 'react';
import { DailyLoop } from '../../app/daily-loop';

export function OfflineAppResume() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setUserId(localStorage.getItem('kayamo:last-user-id'));
    });
    return () => { active = false; };
  }, []);

  if (userId === undefined) return null;
  if (!userId) {
    return (
      <section className="mt-6">
        <h2 className="font-body text-heading">Connect once to resume</h2>
        <p className="mt-4 font-body text-body text-muted">KayaMo needs one signed-in visit before this device can reopen your local daily loop offline.</p>
      </section>
    );
  }
  return <DailyLoop userId={userId} />;
}
