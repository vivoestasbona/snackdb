'use client';

import { useState } from 'react';
import QuestionCreate from './QuestionCreate.jsx';
import QuestionsList from './QuestionsList.jsx';

export default function QuizEditClient({ slug }) {
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <QuestionCreate slug={slug} onCreated={() => setReloadKey(k => k + 1)} />
      <QuestionsList slug={slug} reloadSignal={reloadKey} />
    </div>
  );
}
