import { Box } from "grommet";

export default function PageContainer({ children }) {
  return (
    <Box
      pad={{ horizontal: "medium", vertical: "medium" }}
      gap="small"
      style={{
        maxWidth: 1350,
        width: "100%",
        margin: "0 auto",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
      fill="vertical"
      overflow={"auto"}
    >
      {children}
    </Box>
  );
}
