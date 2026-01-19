import React from 'react';
import { Box, Button, Text } from 'grommet';
import { Link } from 'react-router-dom';

import PageContainer from '../components/layout/PageContainer.jsx';

export default function NotFoundPage() {
  return (
    <PageContainer>
      <Box gap="small" align="start">
        <Text size="xxlarge" weight={700}>404</Text>
        <Text color="text-muted">Page not found.</Text>
        <Button as={Link} to="/" label="Back to Dashboard" />
      </Box>
    </PageContainer>
  );
}
