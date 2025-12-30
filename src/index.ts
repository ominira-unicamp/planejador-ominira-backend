import 'dotenv/config'
import express, { Router } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import openapi from './OpenApi'
import Controlellers from './Controllers'
import errorHandler from './Middlewares/erroHandler'
import jsonErrorHandler from './Middlewares/jsonErrorHandler'
const app = express()
const corsOrigin = process.env.CORS_ORIGIN || '*'
app.use(cors({
  origin: corsOrigin === '*' ? '*' : corsOrigin.split(','),
  credentials: true,
}))

Controlellers.authRegistry.addException('GET', '/openapi.json');
Controlellers.authRegistry.addException('GET', '/docs');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net", " https://fonts.scalar.com"],
      imgSrc: ["'self'", "data:", "https://cdn.jsdelivr.net"],
      workerSrc: ["'self'", "blob:"],
      connectSrc: ["'self'"],
    },
  },
}))
app.use(express.json())
app.use(jsonErrorHandler)
app.use(Controlellers.authRegistry.middleware())
app.use(openapi.router)
app.use(Controlellers.router)
app.use(errorHandler)

const port = process.env.PORT || 3000
const server = app.listen(port, () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Docs: http://localhost:${port}/docs`)
  }
})