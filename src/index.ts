import 'dotenv/config'
import express from 'express'
import openapi from './OpenApi'
import Controlellers from './Controllers'
import errorHandler from './Middlewares/erroHandler'
import jsonErrorHandler from './Middlewares/jsonErrorHandler'
import { AuthRegistry } from './auth'
const app = express()

Controlellers.authRegistry.addException('GET', '/openapi.json');
Controlellers.authRegistry.addException('GET', '/docs');

app.use(express.json())
app.use(jsonErrorHandler)
app.use(Controlellers.authRegistry.middleware())
app.use(openapi.router)
app.use(Controlellers.router)
app.use(errorHandler)

const server = app.listen(3000, () =>
  console.log(`Docs: http://localhost:3000/docs`)
)