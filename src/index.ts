import 'dotenv/config'
import { Prisma, PrismaClient } from '../prisma/generated/client'
import { PrismaPg } from '@prisma/adapter-pg'
import express from 'express'

const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter: pool })

const app = express()

app.use(express.json())


const server = app.listen(3000, () =>
  console.log(`🚀 Server ready at: http://localhost:3000`)
)