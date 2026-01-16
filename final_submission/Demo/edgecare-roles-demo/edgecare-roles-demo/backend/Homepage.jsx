import { useEffect, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Typography,
  Paper,
  Stack,
  Divider,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material'

export default function Home() {
  const navigate = useNavigate()

  // Simulated initial app loading (e.g., config/user/session check)
  const [isAppLoading, setIsAppLoading] = useState(true)

  // UI feedback (e.g., success after report submission redirect)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  useEffect(() => {
    const t = setTim
