import React from 'react';
import { Box, Grid, Text } from 'grommet';
import ProductCard from './ProductCard.jsx';

export default function ProductsGrid({ products, onLoad, onDelete }) {
  if (!products?.length) {
    return (
      <Box pad="medium" align="center">
        <Text color="text-muted">No saved products yet.</Text>
      </Box>
    );
  }

  return (
    <Grid
      columns={{ count: 'fit', size: 'medium' }}
      gap="medium"
    >
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onLoad={onLoad} onDelete={onDelete} />
      ))}
    </Grid>
  );
}
