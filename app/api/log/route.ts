import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(req: Request) {
  const body = await req.json()
  const { question, answer, correct } = body

  const log = await prisma.quizLog.create({
    data: { question, answer, correct },
  })

  return NextResponse.json(log)
}
