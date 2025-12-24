import 'dotenv/config'
import express from 'express'
import openapi from './OpenApi'
import Controlellers from './Controlellers'

const app = express()

app.use(express.json())
app.use(openapi.router)
app.use(Controlellers.router)


const server = app.listen(3000, () =>
  console.log(`Docs: http://localhost:3000/docs`)
)