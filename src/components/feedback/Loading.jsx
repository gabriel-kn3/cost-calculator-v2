import { Card, CardBody, Box, Spinner, Text } from "grommet";

export default function LoadingCard({ label = "Loading…" }) {
  return (
    <Card
      round="medium"
      elevation="small"
      background="card-bg"
      align="center"
      justify="center"
      style={{
        border: "1px solid rgba(0,0,0,0.06)",
        maxWidth: 420,
        width: "100%",
      }}
    >
      <CardBody pad="medium">
        <Box align="center" justify="center" gap="small" height="small">
          <Spinner color={"brand"} />
          <Text size="small" color="text-muted">
            {label}
          </Text>
        </Box>
      </CardBody>
    </Card>
  );
}
