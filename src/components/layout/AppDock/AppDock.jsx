import { useEffect, useMemo, useState } from "react";
import { Box, Button, Text } from "grommet";

import { useApp } from "../../../hooks/app/AppProvider.jsx";
import CommandLegendModal from "./CommandLegendModal.jsx";

export default function AppDock() {
  const app = useApp();
  const [legendOpen, setLegendOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && (e.key === "/" || e.code === "Slash")) {
        e.preventDefault();
        setLegendOpen(true);
      }
      // optional per-action hotkeys
      const key = e.key?.toLowerCase();
      const actions = app.state.dock.actions || [];
      const hit = actions.find(
        (a) => a.hotkey && a.hotkey.toLowerCase() === key
      );
      if (hit && e.ctrlKey) {
        e.preventDefault();
        hit.onClick?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [app]);

  const actions = useMemo(
    () => app.state.dock.actions || [],
    [app.state.dock.actions]
  );

  return (
    <>
      <CommandLegendModal
        open={legendOpen}
        actions={actions}
        onClose={() => setLegendOpen(false)}
      />

      {/* <Box
        direction="row"
        align="center"
        justify="between"
        pad={{ horizontal: "medium", vertical: "small" }}
        gap="medium"
        background="card-bg"
        elevation="small"
        round="medium"
        style={{
          position: "fixed",
          left: 16,
          right: 16,
          bottom: 16,
          zIndex: 10,
          border: "1px solid rgba(0,0,0,0.06)",
          backdropFilter: "blur(10px)",
        }}
      >
        <Box direction="row" align="center" gap="small" wrap>
          <Text weight={700}>Dock</Text>
          <Text size="small" color="text-muted">
            Ctrl+/
          </Text>
        </Box>

        <Box direction="row" gap="xsmall" wrap justify="end">
          {actions.map((a) => (
            <Button key={a.id} label={a.label} onClick={a.onClick} />
          ))}
        </Box>
      </Box> */}
    </>
  );
}
