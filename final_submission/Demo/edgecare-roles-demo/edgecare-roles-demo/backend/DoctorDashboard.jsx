import {
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  Link,
  Box
} from '@mui/material'

const mockCases = [
  { id: 'C-2025-001', patient: 'John D.', severity: 'high', rec: 'Seek care' },
  { id: 'C-2025-002', patient: 'Sara K.', severity: 'moderate', rec: 'Monitor at home' },
  { id: 'C-2025-003', patient: 'Amit P.', severity: 'low', rec: 'Monitor at home' },
]

const weeklyTasks = [
  {
    task: 'Design and implement Doctor Dashboard UI',
    commits: [
      { label: 'Initial dashboard layout', url: 'https://github.com/org/repo/commit/abc123' },
      { label: 'Severity indicators and case list', url: 'https://github.com/org/repo/commit/def456' },
    ],
    verification:
      'Verify by running the application and confirming that recent cases render correctly with severity labels and recommendations.'
  },
  {
    task: 'Add mock clinical case data for demo purposes',
    commits: [
      { label: 'Mock data integration', url: 'https://github.com/org/repo/commit/ghi789' },
    ],
    verification:
      'Verify by inspecting the UI and ensuring multiple patient cases appear without backend dependency.'
  },
  {
    task: 'Ensure UI aligns with software design documentation standards',
    commits: [
      { label: 'UI consistency and documentation updates', url: 'https://github.com/org/repo/commit/jkl012' },
    ],
    verification:
      'Verify by reviewing component structure, consistent naming conventions, and alignment with documented UI requirements.'
  }
]

export default function DoctorDashboard() {
  return (
    <Paper sx={{ p: 3 }}>
      {/* ================== Doctor Portal ================== */}
      <Typography variant="h6" sx={{ mb: 2 }}>
        Doctor Portal — Recent Cases (Demo)
      </Typography>

      <List>
        {mockCases.map(c => (
          <ListItem key={c.id} divider>
            <ListItemText
              primary={`${c.id} • ${c.patient}`}
              secondary={`Recommendation: ${c.rec}`}
            />
            <Chip
              color={
                c.severity === 'high'
                  ? 'error'
                  : c.severity === 'moderate'
                  ? 'warning'
                  : 'success'
              }
              label={c.severity.toUpperCase()}
            />
          </ListItem>
        ))}
      </List>

      <Divider sx={{ my: 3 }} />

      {/* ================== Weekly Task Report ================== */}
      <Typography variant="h6" sx={{ mb: 1 }}>
        Weekly Task Summary
      </Typography>

      {weeklyTasks.map((item, index) => (
        <Box key={index} sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {index + 1}. {item.task}
          </Typography>

          <Typography variant="body2" sx={{ mt: 0.5 }}>
            <strong>Related Commits:</strong>
          </Typography>

          <List dense>
            {item.commits.map((c, i) => (
              <ListItem key={i} sx={{ pl: 2 }}>
                <ListItemText
                  primary={
                    <Link href={c.url} target="_blank" rel="noopener">
                      {c.label}
                    </Link>
                  }
                />
              </ListItem>
            ))}
          </List>

          <Typography variant="body2">
            <strong>Verification Method:</strong> {item.verification}
          </Typography>
        </Box>
      ))}
    </Paper>
  )
}
