import React from 'react';
import { Box, Notification } from 'grommet';
import { useApp } from '../../hooks/app/AppProvider.jsx';

export default function Toasts() {
  const app = useApp();
  const toasts = app.state.toasts || [];

  if (!toasts.length) return null;

  return (
    <Box
      style={{ position: 'fixed', top: 16, right: 16, zIndex: 20 }}
      gap="small"
    >
      {toasts.map((t) => (
        <Notification
          key={t.id}
          toast
          status={t.status || 'normal'}
          message={t.message}
          onClose={() => {}} 
        />
      ))}
    </Box>
  );
}
