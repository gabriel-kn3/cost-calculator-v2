import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Grommet } from 'grommet';

import App from './App.jsx';
import { buildTheme } from './theme/buildTheme.js';
import themeJson from './theme/theme.json';

import { AppProvider } from './hooks/app/AppProvider.jsx';
import { MaterialsProvider } from './hooks/materials/MaterialsProvider.jsx';
import { ProductsProvider } from './hooks/products/ProductsProvider.jsx';
import { CalculationProvider } from './hooks/calculation/CalculationProvider.jsx';

const theme = buildTheme(themeJson);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Grommet theme={theme} full>
      <BrowserRouter>
        <AppProvider>
          <MaterialsProvider>
            <ProductsProvider>
              <CalculationProvider>
                <App />
              </CalculationProvider>
            </ProductsProvider>
          </MaterialsProvider>
        </AppProvider>
      </BrowserRouter>
    </Grommet>
  </React.StrictMode>
);
