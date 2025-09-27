import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    // 過去に出題された問題を取得（question, answerのペアで）
    const quizHistory = await prisma.quizLog.findMany({
      select: {
        question: true,
        answer: true,
      },
      distinct: ['question', 'answer'],
    })

    return NextResponse.json({ history: quizHistory })
  } catch (error) {
    console.error('Error fetching quiz history:', error)
    return NextResponse.json(
      { error: 'クイズ履歴の取得に失敗しました。' },
      { status: 500 }
    )
  }
}
