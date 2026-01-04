import { PrismaClient, DayOfWeek } from './generated/client.js'
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

  // Coletar todos os dados para inserção em batch
  const allInstitutes: Map<string, { code: string }> = new Map()
  const allProfessors: Map<string, { name: string }> = new Map()
  const allRooms: Map<string, { code: string }> = new Map()
  const allCourses: Map<string, { code: string; name: string; instituteCode: string; credits: number }> = new Map()
  const studyPeriods: { code: string; startDate: Date }[] = []

  // Primeira passagem: coletar todos os dados únicos
  console.log('📊 Coletando dados...')
  for (const periodo of seedData) {
    //if (periodo.ano < 2024) continue

    studyPeriods.push({
      code: `${periodo.ano}s${periodo.semestre}`,
      startDate: new Date(`${periodo.ano}-${periodo.semestre === 1 ? '02' : '08'}-01`),
    })

    for (const institutoData of periodo.institutos) {
      //if (!["IC", "FEEC"].includes(institutoData.nome)) continue

      allInstitutes.set(institutoData.nome, { code: institutoData.nome })

      for (const disciplinaData of institutoData.diciplinas) {
        allCourses.set(disciplinaData.codigo, {
          code: disciplinaData.codigo,
          name: disciplinaData.nome,
          instituteCode: institutoData.nome,
          credits: 4,
        })

        for (const turmaData of disciplinaData.turmas) {
          turmaData.docentes
            .filter(d => d && d.trim() !== '')
            .forEach(d => allProfessors.set(d.trim(), { name: d.trim() }))

          turmaData.aulas.forEach(a => allRooms.set(a.sala, { code: a.sala }))
        }
      }
    }
  }

  // Inserir institutos em batch
  console.log(`\n🏛️  Inserindo ${allInstitutes.size} institutos...`)
  await prisma.institute.createMany({
    data: Array.from(allInstitutes.values()),
    skipDuplicates: true,
  })

  // Inserir professores em batch
  console.log(`👨‍🏫 Inserindo ${allProfessors.size} professores...`)
  await prisma.professor.createMany({
    data: Array.from(allProfessors.values()),
    skipDuplicates: true,
  })

  // Inserir salas em batch
  console.log(`🚪 Inserindo ${allRooms.size} salas...`)
  await prisma.room.createMany({
    data: Array.from(allRooms.values()),
    skipDuplicates: true,
  })

  // Inserir períodos de estudo em batch
  console.log(`📅 Inserindo ${studyPeriods.length} períodos de estudo...`)
  await prisma.studyPeriod.createMany({
    data: studyPeriods,
    skipDuplicates: true,
  })

  // Buscar institutos criados para pegar IDs
  const institutesMap = new Map(
    (await prisma.institute.findMany()).map(i => [i.code, i])
  )

  // Inserir cursos em batch
  console.log(`📚 Inserindo ${allCourses.size} cursos...`)
  await prisma.course.createMany({
    data: Array.from(allCourses.values()).map(c => ({
      code: c.code,
      name: c.name,
      credits: c.credits,
      instituteId: institutesMap.get(c.instituteCode)!.id,
    })),
    skipDuplicates: true,
  })

  // Buscar dados criados para pegar IDs
  const professorsMap = new Map(
    (await prisma.professor.findMany()).map(p => [p.name, p])
  )
  const roomsMap = new Map(
    (await prisma.room.findMany()).map(r => [r.code, r])
  )
  const coursesMap = new Map(
    (await prisma.course.findMany()).map(c => [c.code, c])
  )
  const studyPeriodsMap = new Map(
    (await prisma.studyPeriod.findMany()).map(sp => [sp.code, sp])
  )

  // Coletar todas as turmas para inserção em batch
  console.log('\n👥 Coletando turmas...')
  const allClasses: Array<{
    code: string
    courseId: number
    studyPeriodId: number
    reservations: number[]
    professorIds: number[]
    turmaKey: string
  }> = []

  for (const periodo of seedData) {
    //if (periodo.ano < 2024) continue

    const studyPeriod = studyPeriodsMap.get(`${periodo.ano}s${periodo.semestre}`)!

    for (const institutoData of periodo.institutos) {
      //if (!["IC", "FEEC"].includes(institutoData.nome)) continue

      for (const disciplinaData of institutoData.diciplinas) {
        const course = coursesMap.get(disciplinaData.codigo)!

        for (const turmaData of disciplinaData.turmas) {
          const professorIds = turmaData.docentes
            .filter(d => d && d.trim() !== '')
            .map(d => professorsMap.get(d.trim())!.id)

          allClasses.push({
            code: turmaData.nome,
            courseId: course.id,
            studyPeriodId: studyPeriod.id,
            reservations: turmaData.reservas,
            professorIds,
            turmaKey: `${periodo.ano}-${periodo.semestre}-${disciplinaData.codigo}-${turmaData.nome}`,
          })
        }
      }
    }
  }

  // Inserir todas as turmas em batch sem professores
  console.log(`👥 Inserindo ${allClasses.length} turmas...`)
  await prisma.class.createMany({
    data: allClasses.map(c => ({
      code: c.code,
      courseId: c.courseId,
      studyPeriodId: c.studyPeriodId,
      reservations: c.reservations,
    })),
    skipDuplicates: true,
  })

  // Buscar todas as classes criadas
  console.log('🔍 Buscando turmas criadas...')
  const createdClassesArray = await prisma.class.findMany({
    include: { course: true, studyPeriod: true }
  })

  // Criar mapa de turmas por chave única
  const classesMap = new Map(
    createdClassesArray.map((c) => [
      `${c.studyPeriod.code.split('s')[0]}-${c.studyPeriod.code.split('s')[1]}-${c.course.code}-${c.code}`,
      c
    ])
  )

  // Preparar conexões com professores em batch
  console.log('🔗 Conectando professores às turmas...')
  const professorConnections: Array<{ A: number; B: number }> = []

  for (const classData of allClasses) {
    const classEntity = classesMap.get(classData.turmaKey)
    if (!classEntity) continue

    for (const professorId of classData.professorIds) {
      professorConnections.push({
        A: classEntity.id,
        B: professorId,
      })
    }
  }

  // Inserir conexões em batch usando executeRaw
  console.log(`🔗 Inserindo ${professorConnections.length} conexões professor-turma...`)
  if (professorConnections.length > 0) {
    const values = professorConnections.map(c => `(${c.A}, ${c.B})`).join(', ')
    await prisma.$executeRawUnsafe(
      `INSERT INTO "_ClassToProfessor" ("A", "B") VALUES ${values} ON CONFLICT DO NOTHING`
    )
  }

  // Coletar todos os horários para inserção em batch
  console.log('📅 Coletando horários...')
  const allSchedules: Array<{
    classId: number
    roomId: number
    dayOfWeek: DayOfWeek
    start: string
    end: string
  }> = []

  for (const periodo of seedData) {
    //if (periodo.ano < 2024) continue

    for (const institutoData of periodo.institutos) {
      //if (!["IC", "FEEC"].includes(institutoData.nome)) continue

      for (const disciplinaData of institutoData.diciplinas) {
        for (const turmaData of disciplinaData.turmas) {
          const turmaKey = `${periodo.ano}-${periodo.semestre}-${disciplinaData.codigo}-${turmaData.nome}`
          const classEntity = classesMap.get(turmaKey)!

          for (const aulaData of turmaData.aulas) {
            const dayOfWeek = dayOfWeekMap[aulaData.dia_semana]
            if (!dayOfWeek) continue

            const room = roomsMap.get(aulaData.sala)!
            allSchedules.push({
              classId: classEntity.id,
              roomId: room.id,
              dayOfWeek,
              start: aulaData.horario.inicio,
              end: aulaData.horario.fim,
            })
          }
        }
      }
    }
  }

  // Inserir todos os horários em batch
  console.log(`📅 Inserindo ${allSchedules.length} horários...`)
  await prisma.classSchedule.createMany({
    data: allSchedules,
  })

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
