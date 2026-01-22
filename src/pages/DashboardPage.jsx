import React from "react";
import { Box, Button, Grid, Text } from "grommet";
import { Link } from "react-router-dom";

import PageContainer from "../components/layout/PageContainer.jsx";
import SectionCard from "../components/layout/SectionCard.jsx";

import { useMaterials } from "../hooks/materials/MaterialsProvider.jsx";
import { useProducts } from "../hooks/products/ProductsProvider.jsx";

export default function DashboardPage() {
  const materials = useMaterials();
  const products = useProducts();

  // console.debug(" Dashboard => Materials => ", materials);
  // console.debug("Dashboard => Products => ", products);

  return (
    <PageContainer>
      <Box gap="small" pad={{ bottom: "large" }}>
        <Text size="xxlarge" weight={700}>
          Dashboard
        </Text>
        <Text color="text-muted">
          Handmade by Bet tool for calculating prouct costs and warehousing
          materials.
        </Text>
      </Box>

      <Grid columns={{ count: "fit", size: "medium" }} gap="medium">
        <SectionCard
          title="Materials"
          subtitle={`${materials.materials.length} in inventory`}
          actions={<Button as={Link} to="/inventory" label="Open" primary />}
        >
          <Text size="small" color="text-muted">
            Manage your prime matter: base cost + base quantity. Mark common
            items with “*”.
          </Text>
        </SectionCard>

        <SectionCard
          title="Calculator"
          subtitle="Build a draft product and compute totals"
          actions={<Button as={Link} to="/calculator" label="Open" primary />}
        >
          <Text size="small" color="text-muted">
            Add rows, edit base values, set used quantities, and optionally
            include labor.
          </Text>
        </SectionCard>

        <SectionCard
          title="Saved Products"
          subtitle={`${products.products.length} saved`}
          actions={<Button as={Link} to="/products" label="Open" primary />}
        >
          <Text size="small" color="text-muted">
            Save your draft calculations for later, export/import JSON, and
            reload into the calculator.
          </Text>
        </SectionCard>
      </Grid>

      <SectionCard
        title="Quick Tips"
        cardStyleProps={{
          minHeight: "100px",
          maxHeight: "200px",
        }}
      >
        <Text size="small">• Ctrl + / opens the dock command legend.</Text>
        <Text size="small">
          • Ctrl + (I/E/S/C) trigger dock actions per page.
        </Text>
        {/* <Text size="small">
          • Import/export uses the same JSON format across materials/products.
        </Text> */}
      </SectionCard>
    </PageContainer>
  );
}
