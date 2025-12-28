import { PrismaClient, DayOfWeek } from './generated/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { readFileSync } from 'fs'
import { join } from 'path'
import dotenv from 'dotenv'

dotenv.config()
const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter: pool })
interface Aula {
  dia_semana: string
  horario: {
    inicio: string
    fim: string
  }
  sala: string
}
interface Turma {
  nome: string
  docentes: string[]
  aulas: Aula[]
  reservas: number[]
}
interface Disciplina {
  codigo: string
  nome: string
  turmas: Turma[]
}
interface Instituto {
  nome: string
  diciplinas: Disciplina[]
}
interface SeedData {
  ano: number
  semestre: number
  institutos: Instituto[]
}

const dayOfWeekMap: Record<string, DayOfWeek> = {
  'Segunda': DayOfWeek.MONDAY,
  'Terça': DayOfWeek.TUESDAY,
  'Quarta': DayOfWeek.WEDNESDAY,
  'Quinta': DayOfWeek.THURSDAY,
  'Sexta': DayOfWeek.FRIDAY,
  'Sábado': DayOfWeek.SATURDAY,
  'Domingo': DayOfWeek.SUNDAY,
}

async function main() {
  console.log('🌱 Iniciando seeding...')

  const seedDataPath = join(__dirname, 'seed.json')
  const seedDataRaw = readFileSync(seedDataPath, 'utf-8')
  const seedData: SeedData[] = JSON.parse(seedDataRaw)

  console.log('🗑️  Limpando dados existentes...')
  await prisma.classSchedule.deleteMany()
  await prisma.class.deleteMany()
  await prisma.room.deleteMany()
  await prisma.professor.deleteMany()
  await prisma.studyPeriod.deleteMany()
  await prisma.programModalityCourse.deleteMany()
  await prisma.studentCourse.deleteMany()
  await prisma.student.deleteMany()
  await prisma.catalogProgram.deleteMany()
  await prisma.catalog.deleteMany()
  await prisma.program.deleteMany()
  await prisma.modality.deleteMany()
  await prisma.course.deleteMany()
  await prisma.prefixes.deleteMany()
  await prisma.institute.deleteMany()

  // Processar cada período de estudo
  for (const periodo of seedData) {
    console.log(`\n📅 Processando ${periodo.ano}/${periodo.semestre}`)
    if (periodo.ano < 2024)
      continue;
    // Criar período de estudo
    const studyPeriod = await prisma.studyPeriod.create({
      data: {
        code: `${periodo.ano}s${periodo.semestre}`,
        startDate: new Date(`${periodo.ano}-${periodo.semestre === 1 ? '02' : '08'}-01`),
      },
    })
    console.log(`   ✅ Período de estudo criado: ${studyPeriod.code}`)

    // Processar institutos
    for (const institutoData of periodo.institutos) {
      if (!["IC", "FEEC"].includes(institutoData.nome))
        continue;
      console.log(`\n   🏛️  Instituto: ${institutoData.nome}`)

      // Criar instituto
      const institute = await prisma.institute.findFirst({ where: { code: institutoData.nome } }) || await prisma.institute.create({
        data: {
          code: institutoData.nome,
        },
      })

      // Processar disciplinas
      for (const disciplinaData of institutoData.diciplinas) {
        console.log(`      📚 Disciplina: ${disciplinaData.codigo} - ${disciplinaData.nome}`)

        // Criar ou buscar curso
        const course = await prisma.course.upsert({
          where: { code: disciplinaData.codigo },
          update: {},
          create: {
            code: disciplinaData.codigo,
            name: disciplinaData.nome,
            instituteId: institute.id,
            credits: 4, // Valor padrão
          },
        })


        // Processar turmas
        for (const turmaData of disciplinaData.turmas) {
          console.log(`         👥 Turma: ${turmaData.nome}`)

          // Criar ou buscar professores
          const professors = await Promise.all(
            turmaData.docentes.filter(docenteNome => docenteNome && docenteNome.trim() !== '').map(async (docenteNome) => {
              const docente = await prisma.professor.findFirst({ where: { name: docenteNome.trim() } })
              if (docente) {  
                return docente
              } else {
                console.log(`Criando docente: ${docenteNome}`)
                return await prisma.professor.create({ data: { name: docenteNome.trim() } })
              }
            })
          )

          // Criar turma
          const classEntity = await prisma.class.create({
            data: {
              code: turmaData.nome,
              courseId: course.id,
              studyPeriodId: studyPeriod.id,
              reservations: turmaData.reservas,
              professors: {
                connect: professors.map(t => ({ id: t.id })),
              },
            },
          })

          // Processar aulas (horários)
          for (const aulaData of turmaData.aulas) {
            // Criar ou buscar sala
            const room = await prisma.room.upsert({
              where: { code: aulaData.sala },
              update: {},
              create: { code: aulaData.sala },
            })

            // Criar horário de aula
            const dayOfWeek = dayOfWeekMap[aulaData.dia_semana]
            if (!dayOfWeek) {
              console.warn(`         ⚠️  Dia da semana não reconhecido: ${aulaData.dia_semana}`)
              continue
            }

            await prisma.classSchedule.create({
              data: {
                classId: classEntity.id,
                roomId: room.id,
                dayOfWeek: dayOfWeek,
                start: aulaData.horario.inicio,
                end: aulaData.horario.fim,
              },
            })
          }

          console.log(`         ✅ Turma ${turmaData.nome} criada com ${turmaData.aulas.length} aulas`)
        }
      }
    }
  }

  console.log('\n✨ Seeding concluído com sucesso!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Erro durante seeding:', e)
    await prisma.$disconnect()
    process.exit(1)
  }) 
