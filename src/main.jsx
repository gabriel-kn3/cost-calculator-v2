import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Grommet } from "grommet";

import App from "./App.jsx";
import { buildTheme } from "./theme/buildTheme.js";
import themeJson from "./theme/theme.json";

import { AppProvider } from "./hooks/app/AppProvider.jsx";
import { MaterialsProvider } from "./hooks/materials/MaterialsProvider.jsx";
import { ProductsProvider } from "./hooks/products/ProductsProvider.jsx";
import { CalculationProvider } from "./hooks/calculation/CalculationProvider.jsx";
import { AuthProvider } from "./hooks/auth/AuthProvider.jsx";

const theme = buildTheme(themeJson);

createRoot(document.getElementById("root")).render(
  <Grommet theme={theme} full>
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <MaterialsProvider>
            <ProductsProvider>
              <CalculationProvider>
                <App />
              </CalculationProvider>
            </ProductsProvider>
          </MaterialsProvider>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  </Grommet>
);
