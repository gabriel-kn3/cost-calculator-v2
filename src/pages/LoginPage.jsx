import { useState } from "react";
import { Box, Button, Card, CardBody, Heading, Text, TextInput } from "grommet";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/auth/AuthProvider";

export default function LoginPage() {
  const auth = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async () => {
    setErr("");
    setBusy(true);
    try {
      await auth.login(email, password);
      nav("/"); // or /calculator
    } catch (e) {
      setErr("Invalid credentials.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box fill align="center" justify="center" pad="medium">
      <Card width="medium" round="medium" elevation="small">
        <CardBody pad="medium" gap="medium">
          <Box>
            <Heading level={3} margin="none">
              Sign in
            </Heading>
            <Text size="small" color="text-muted">
              Authorized users only.
            </Text>
          </Box>

          <Box gap="xsmall">
            <Text size="small" color="text-muted">
              Email
            </Text>
            <TextInput
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Box>

          <Box gap="xsmall">
            <Text size="small" color="text-muted">
              Password
            </Text>
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Box>

          {err && (
            <Text color="status-critical" size="small">
              {err}
            </Text>
          )}

          <Button
            primary
            label={busy ? "Signing in..." : "Log In"}
            onClick={onSubmit}
            disabled={busy}
          />
        </CardBody>
      </Card>
    </Box>
  );
}
