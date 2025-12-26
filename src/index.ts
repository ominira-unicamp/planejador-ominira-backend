import 'dotenv/config'
import express from 'express'
import openapi from './OpenApi'
import Controlellers from './Controllers'
import errorHandler from './Middlewares/erroHandler'

const app = express()

app.use(express.json())
app.use(openapi.router)
app.use(Controlellers.router)
app.use(errorHandler)

const server = app.listen(3000, () =>
  console.log(`Docs: http://localhost:3000/docs`)
)