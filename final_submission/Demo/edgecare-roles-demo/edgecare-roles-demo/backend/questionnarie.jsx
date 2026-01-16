import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../state/AppContext.jsx'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Slider,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  Snackbar,
  CircularProgress,
  Typography
} from '@mui/material'
import QuestionCard from '../components/QuestionCard.jsx'

export default function Questionnaire() {
  const { caseData, setCaseData } = useApp()
  const nav = useNavigate()
  const q = caseData.questionnaire

  const save = (patch) =>
    setCaseData({ ...caseData, questionnaire: { ...q, ...patch } })

  // UX: local "processing" state for Next transition / save
  const [isProcessing, setIsProcessing] = useState(false)

  // Validation state
  const [touched, setTouched] = useState({ durationDays: false })
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  // Ensure numeric defaults (prevents uncontrolled/NaN edge cases)
  useEffect(() => {
    const patch = {}
    if (q?.itch === undefined || q?.itch === null) patch.itch = 0
    if (q?.pain === undefined || q?.pain === null) patch.pain = 0
    if (q?.durationDays === undefined || q?.durationDays === null) patch.durationDays = ''
    if (q?.recurrence === undefined || q?.recurrence === null) patch.recurrence = false

    if (Object.keys(patch).length) save(patch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const durationNumber = useMemo(() => {
    if (q.durationDays === '' || q.durationDays === null || q.durationDays === undefined) return NaN
    return Number(q.durationDays)
  }, [q.durationDays])

  const errors = useMemo(() => {
    const e = {}

    // Duration validation
    if (Number.isNaN(durationNumber)) e.durationDays = 'Duration is required.'
    else if (!Number.isFinite(durationNumber)) e.durationDays = 'Duration must be a valid number.'
    else if (durationNumber < 0) e.durationDays = 'Duration cannot be negative.'
    else if (durationNumber > 3650) e.durationDays = 'Duration seems too high (max 3650 days).'

    // Slider bounds safety checks (should already be constrained by Slider)
    if (q.itch < 0 || q.itch > 10) e.itch = 'Itch must be between 0 and 10.'
    if (q.pain < 0 || q.pain > 10) e.pain = 'Pain must be between 0 and 10.'

    return e
  }, [durationNumber, q.itch, q.pain])

  const isValid = Object.keys(errors).length === 0

  const handleNext = async () => {
    // Mark fields as touched so errors show
    setTouched((t) => ({ ...t, durationDays: true }))

    if (!isValid) {
      setToast({
        open: true,
        message: 'Please fix validation errors before continuing.',
        severity: 'error'
      })
      return
    }

    try {
      setIsProcessing(true)

      // Optional: normalize duration to number before leaving page
      save({ durationDays: durationNumber })

      // Simulate processing (e.g., saving draft or prefetching next step)
      await new Promise((r) => setTimeout(r, 400))

      setToast({
        open: true,
        message: 'Questionnaire saved successfully.',
        severity: 'success'
      })

      nav('/patient/input')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <Box sx={{ mt: 1 }}>
        {isProcessing && (
          <Alert
            icon={<CircularProgress size={18} />}
            severity="info"
            sx={{ mb: 2, alignItems: 'center' }}
          >
            Saving your answers…
          </Alert>
        )}

        <QuestionCard title="Itch level (0-10)">
          <Slider
            value={Number(q.itch) || 0}
            onChange={(_, v) => save({ itch: v })}
            min={0}
            max={10}
            step={1}
            marks
            aria-label="Itch level"
          />
          {!!errors.itch && (
            <Typography variant="caption" color="error">
              {errors.itch}
            </Typography>
          )}
        </QuestionCard>

        <QuestionCard title="Pain level (0-10)">
          <Slider
            value={Number(q.pain) || 0}
            onChange={(_, v) => save({ pain: v })}
            min={0}
            max={10}
            step={1}
            marks
            aria-label="Pain level"
          />
          {!!errors.pain && (
            <Typography variant="caption" color="error">
              {errors.pain}
            </Typography>
          )}
        </QuestionCard>

        <QuestionCard title="Duration (days)">
          <TextField
            type="number"
            value={q.durationDays}
            onChange={(e) => save({ durationDays: e.target.value })}
            onBlur={() => setTouched((t) => ({ ...t, durationDays: true }))}
            inputProps={{ min: 0, max: 3650 }}
            error={touched.durationDays && !!errors.durationDays}
            helperText={touched.durationDays ? errors.durationDays : 'Enter number of days.'}
            fullWidth
          />
        </QuestionCard>

        <QuestionCard title="Had this previously?">
          <FormControlLabel
            control={
              <Switch
                checked={!!q.recurrence}
                onChange={(e) => save({ recurrence: e.target.checked })}
              />
            }
            label={q.recurrence ? 'Yes' : 'No'}
          />
        </QuestionCard>

        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Button variant="outlined" onClick={() => nav('/patient')} disabled={isProcessing}>
            Back
          </Button>
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={isProcessing}
            startIcon={isProcessing ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {isProcessing ? 'Saving…' : 'Next: Image/Text'}
          </Button>
        </Box>
      </Box>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          severity={toast.severity}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  )
}
