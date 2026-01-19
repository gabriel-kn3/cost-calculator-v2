export function buildTheme(themeJson) {
  const t = themeJson || {};
  const colors = t.colors || {};
  const radius = t.radius || {};
  const spacing = t.spacing || {};
  const typography = t.typography || {};

  return {
    global: {
      colors: {
        brand: colors.brand || '#111111',
        accent: colors.accent || '#F6C344',
        'app-bg': colors.bg || '#F7F7F8',
        'card-bg': colors.card || '#FFFFFF',
        'border': colors.border || '#E6E6E8',
        'text-muted': colors.mutedText || '#666666',
        'status-critical': colors.danger || '#D64545'
      },
      font: {
        family: typography.font || 'system-ui',
        size: '14px',
        height: '20px'
      }
    },
    button: {
      border: {
        radius: `${radius.control || 10}px`
      }
    },
    text: {
      medium: {
        size: '14px',
        height: '20px'
      }
    },
    formField: {
      border: {
        color: 'border'
      }
    },
    card: {
      container: {
        round: `${radius.card || 14}px`
      }
    },
    layer: {
      border: {
        radius: `${radius.card || 14}px`
      }
    },
    spacing: spacing
  };
}
