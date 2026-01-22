import React from "react";
import { Header, Box, Button, Text, Tip, Spinner } from "grommet";
import {
  CircleInformation,
  Logout,
  StatusGood,
  StatusWarning,
  StatusCritical,
} from "grommet-icons";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/auth/AuthProvider";
import useHealthStatus from "../../hooks/app/useHealthStatus";

function NavButton({ to, label }) {
  const loc = useLocation();
  const active = loc.pathname === to;
  return (
    <Button
      as={Link}
      to={to}
      plain
      label={
        <Box
          pad={{ horizontal: "small", vertical: "xsmall" }}
          round="small"
          background={active ? "accent" : undefined}
        >
          <Text size="small" weight={600} color={active ? "brand" : undefined}>
            {label}
          </Text>
        </Box>
      }
    />
  );
}

function StatusDot({ status }) {
  if (status === "ok") return <StatusGood size="small" color="status-ok" />;
  if (status === "expired")
    return <StatusWarning size="small" color="status-warning" />;
  if (status === "degraded")
    return <StatusWarning size="small" color="status-warning" />;
  if (status === "down") return <StatusCritical size="small" color="red" />;
  return <CircleInformation size="small" />;
}

export default function AppHeader() {
  const auth = useAuth();
  const nav = useNavigate();
  const health = useHealthStatus({ intervalMs: 60000 });

  const tipText =
    health.status === "ok" ? (
      <Text size="small" color={"status-ok"}>
        {"Connected"}
      </Text>
    ) : health.status === "expired" ? (
      <Text size="small" color={"status-warning"}>
        {"Session expired: Please log in again."}
      </Text>
    ) : health.status === "degraded" ? (
      <Text size="small" color={"status-warning"}>
        {"Server responded but reported an error."}
      </Text>
    ) : health.status === "down" ? (
      <Text size="small" color={"status-critical"}>
        {"Server unreachable."}
      </Text>
    ) : (
      <Text size="small">{"Verifying connection…"}</Text>
    );

  const onLogout = async () => {
    await auth.logout();
    nav("/login", { replace: true });
  };
  return (
    <Header
      pad={{ horizontal: "medium", vertical: "small" }}
      background="card-bg"
      style={{
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        position: "sticky",
        top: 0,
        zIndex: 5,
      }}
    >
      <Box direction="row" align="center" gap="small">
        <Tip
          content={
            <Box pad="small" gap="xsmall" fill background={"white"}>
              {tipText}
              {health.lastOkAt && (
                <Text size="xsmall" color="text-muted">
                  Last OK: {health.lastOkAt.toLocaleString()}
                </Text>
              )}
              <Box direction="row">
                <Button
                  plain
                  onClick={health.check}
                  justify="end"
                  label={
                    health.busy ? (
                      <Spinner color={"brand"} size="small" />
                    ) : (
                      <Text>
                        <u>Refresh</u>
                      </Text>
                    )
                  }
                />
              </Box>
            </Box>
          }
        >
          <Box
            direction="row"
            align="center"
            gap="xsmall"
            pad={{ horizontal: "small", vertical: "xsmall" }}
            round="small"
            style={{ border: "1px solid rgba(0,0,0,0.08)" }}
          >
            <StatusDot status={health.status} />
            <Text size="small" color="text-muted">
              {health.status === "ok"
                ? "Online"
                : health.status === "expired"
                ? "Session"
                : health.status === "down"
                ? "Offline"
                : "Checking"}
            </Text>
          </Box>
        </Tip>
        <Text weight={700}>Cost Calculator</Text>
      </Box>

      <Box direction="row" gap="xsmall" align="center" wrap>
        <NavButton to="/" label="Dashboard" />
        <NavButton to="/inventory" label="Inventory" />
        <NavButton to="/calculator" label="Calculator" />
        <NavButton to="/products" label="Products" />
      </Box>
      <Box direction="row" justify="end">
        <Button
          icon={<Logout size="small" color="red" />}
          label="Logout"
          onClick={onLogout}
          reverse
          secondary
        />
      </Box>
    </Header>
  );
}
