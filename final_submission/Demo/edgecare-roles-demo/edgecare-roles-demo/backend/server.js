import express from 'express'
import bcrypt from 'bcrypt'

const app = express()
app.use(express.json())

/**
 * Mock user (acts like a database record)
 * Password is hashed using bcrypt
 */
const demoUser = {
  email: 'demo@edgecare.com',
  password: bcrypt.hashSync('password123', 10),
  role: 'patient'
}

/**
 * HOME API
 * Verifies backend availability
 */
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'EdgeCare Backend is running'
  })
})

/**
 * LOGIN API
 * Task 1: Authentication
 */
app.post('/login', async (req, res) => {
  const { email, password } = req.body

  // Check email
  if (email !== demoUser.email) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    })
  }

  // Check password (bcrypt)
  const isMatch = await bcrypt.compare(password, demoUser.password)
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    })
  }

  // Successful login
  res.json({
    success: true,
    message: 'Login successful',
    user: {
      email: demoUser.email,
      role: demoUser.role
    }
  })
})

/**
 * ROLE-BASED ACCESS CHECK API
 * Task 2: Authorization
 */
app.post('/check-access', (req, res) => {
  const { role, requiredRole } = req.body

  if (role !== requiredRole) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    })
  }

  res.json({
    success: true,
    message: 'Access granted'
  })
})

/**
 * Start server
 */
app.listen(5000, () => {
  console.log('Backend running on http://localhost:5000')
})
