import { Box, Notification } from "grommet";
import {
  StatusCriticalSmall,
  StatusWarningSmall,
  StatusUnknownSmall,
  Checkmark,
} from "grommet-icons";
import { useApp } from "../../hooks/app/AppProvider.jsx";

const toastIconsByStatus = {
  ok: <Checkmark color="status-ok" />,
  warning: <StatusWarningSmall color="status-warning" />,
  error: <StatusCriticalSmall color="status-critical" />,
  unknown: <StatusUnknownSmall color="grey" />,
};

export default function Toasts() {
  const app = useApp();
  const toasts = app.state.toasts || [];

  if (!toasts.length) return null;

  return (
    <Box
      style={{ position: "fixed", top: 16, right: 16, zIndex: 20 }}
      gap="small"
    >
      {toasts.map((t) => (
        <Notification
          key={t.id}
          toast
          status={t.status || "normal"}
          icon={toastIconsByStatus[t.status] || toastIconsByStatus.unknown}
          message={t.message}
          onClose={() => {}}
        />
      ))}
    </Box>
  );
}
