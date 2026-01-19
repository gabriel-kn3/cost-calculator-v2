import React from 'react';
import { Header, Box, Button, Text } from 'grommet';
import { Link, useLocation } from 'react-router-dom';

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
          pad={{ horizontal: 'small', vertical: 'xsmall' }}
          round="small"
          background={active ? 'accent' : undefined}
        >
          <Text size="small" weight={600} color={active ? 'brand' : undefined}>
            {label}
          </Text>
        </Box>
      }
    />
  );
}

export default function AppHeader() {
  return (
    <Header
      pad={{ horizontal: 'medium', vertical: 'small' }}
      background="card-bg"
      style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', position: 'sticky', top: 0, zIndex: 5 }}
    >
      <Box direction="row" align="center" gap="small">
        <Box
          width="10px"
          height="10px"
          round
          background="accent"
          style={{ boxShadow: '0 0 0 4px rgba(246,195,68,0.25)' }}
        />
        <Text weight={700}>Cost Calculator</Text>
      </Box>

      <Box direction="row" gap="xsmall" align="center" wrap>
        <NavButton to="/" label="Dashboard" />
        <NavButton to="/inventory" label="Inventory" />
        <NavButton to="/calculator" label="Calculator" />
        <NavButton to="/products" label="Products" />
      </Box>
    </Header>
  );
}
