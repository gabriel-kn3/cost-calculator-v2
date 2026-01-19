import { Card, CardBody, CardHeader, CardFooter, Box, Text } from "grommet";

export default function SectionCard({
  title,
  subtitle,
  actions,
  footer,
  children,
  cardStyleProps,
}) {
  return (
    <Card
      background="card-bg"
      elevation="small"
      round="medium"
      flex="grow"
      margin={{ top: "small", bottom: "small" }}
      style={{
        border: "1px solid var(--border-color, rgba(0,0,0,0.06))",
        // display: "flex",
        // flexDirection: "column",
        // height: "auto", // allow growth beyond min
        // Optional cap if page is tall: maxHeight: "80vh",
        ...cardStyleProps,
      }}
    >
      {(title || subtitle || actions) && (
        <CardHeader
          pad={{ horizontal: "medium", vertical: "xsmall" }}
          direction="row"
          justify="between"
          align="center"
        >
          <Box gap="xsmall" flex>
            {title && <Text weight={600}>{title}</Text>}
            {subtitle && (
              <Text size="small" color="text-muted">
                {subtitle}
              </Text>
            )}
          </Box>

          {actions ? (
            <Box direction="row" gap="small" align="center" wrap={false}>
              {actions}
            </Box>
          ) : (
            <Box />
          )}
        </CardHeader>
      )}

      <CardBody pad={{ horizontal: "medium", vertical: "medium" }}>
        {children}
      </CardBody>

      {footer && (
        <CardFooter pad={{ horizontal: "medium", vertical: "small" }}>
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}
