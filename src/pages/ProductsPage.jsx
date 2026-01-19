import React from 'react';
import { Box, Button, Text } from 'grommet';
import { useNavigate } from 'react-router-dom';

import PageContainer from '../components/layout/PageContainer.jsx';
import Toolbar from '../components/layout/Toolbar.jsx';
import ProductsGrid from '../components/products/ProductsGrid.jsx';

import { useApp } from '../hooks/app/AppProvider.jsx';
import { useProducts } from '../hooks/products/ProductsProvider.jsx';
import { useCalculation } from '../hooks/calculation/CalculationProvider.jsx';
import { IO_KINDS, exportJSON } from '../utils/io/ioAdapters.js';

export default function ProductsPage() {
  const app = useApp();
  const products = useProducts();
  const calc = useCalculation();
  const navigate = useNavigate();

  return (
    <PageContainer>
      <Toolbar
        left={<Text size="xxlarge" weight={700}>Saved Products</Text>}
        right={
          <Box direction="row" gap="small" wrap>
            <Button
              label="Import"
              onClick={() =>
                app.openIO({
                  kind: IO_KINDS.PRODUCTS,
                  mode: 'import',
                  onComplete: async ({ imported }) => {
                    await products.replaceAll(imported);
                    app.toast(`Imported ${imported.length} products.`);
                  }
                })
              }
            />
            <Button
              label="Export"
              onClick={() =>
                app.openIO({
                  kind: IO_KINDS.PRODUCTS,
                  mode: 'export',
                  onComplete: async () => {
                    exportJSON({ kind: IO_KINDS.PRODUCTS, data: products.products });
                    app.toast('Exported products JSON.');
                  }
                })
              }
            />
          </Box>
        }
      />

      <ProductsGrid
        products={products.products}
        onLoad={(p) => {
          calc.loadFromProduct(p);
          navigate('/calculator');
          app.toast('Loaded product into calculator.');
        }}
        onDelete={async (p) => {
          const ok = window.confirm(`Delete product: ${p.name}?`);
          if (!ok) return;
          await products.remove(p.id);
          app.toast('Product deleted.');
        }}
      />
    </PageContainer>
  );
}
