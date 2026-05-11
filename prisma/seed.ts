import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BANK: { question: string; answer: string; category?: string }[] = [
  { question: "りんご", answer: "apple", category: "noun" },
  { question: "本", answer: "book", category: "noun" },
  { question: "犬", answer: "dog", category: "noun" },
  { question: "猫", answer: "cat", category: "noun" },
  { question: "水", answer: "water", category: "noun" },
  { question: "学校", answer: "school", category: "noun" },
  { question: "先生", answer: "teacher", category: "noun" },
  { question: "友だち", answer: "friend", category: "noun" },
  { question: "家族", answer: "family", category: "noun" },
  { question: "朝", answer: "morning", category: "noun" },
  { question: "夜", answer: "night", category: "noun" },
  { question: "今日", answer: "today", category: "noun" },
  { question: "明日", answer: "tomorrow", category: "noun" },
  { question: "大きい", answer: "big", category: "adj" },
  { question: "小さい", answer: "small", category: "adj" },
  { question: "新しい", answer: "new", category: "adj" },
  { question: "古い", answer: "old", category: "adj" },
  { question: "暑い", answer: "hot", category: "adj" },
  { question: "寒い", answer: "cold", category: "adj" },
  { question: "楽しい", answer: "fun", category: "adj" },
  { question: "難しい", answer: "difficult", category: "adj" },
  { question: "行く", answer: "go", category: "verb" },
  { question: "来る", answer: "come", category: "verb" },
  { question: "食べる", answer: "eat", category: "verb" },
  { question: "飲む", answer: "drink", category: "verb" },
  { question: "見る", answer: "see", category: "verb" },
  { question: "聞く", answer: "listen", category: "verb" },
  { question: "話す", answer: "speak", category: "verb" },
  { question: "読む", answer: "read", category: "verb" },
  { question: "書く", answer: "write", category: "verb" },
  { question: "買う", answer: "buy", category: "verb" },
  { question: "助ける", answer: "help", category: "verb" },
  { question: "勉強する", answer: "study", category: "verb" },
  { question: "赤", answer: "red", category: "color" },
  { question: "青", answer: "blue", category: "color" },
  { question: "緑", answer: "green", category: "color" },
  { question: "白", answer: "white", category: "color" },
  { question: "黒", answer: "black", category: "color" },
  { question: "月", answer: "moon", category: "noun" },
  { question: "星", answer: "star", category: "noun" },
  { question: "海", answer: "sea", category: "noun" },
  { question: "山", answer: "mountain", category: "noun" },
  { question: "川", answer: "river", category: "noun" },
  { question: "空", answer: "sky", category: "noun" },
  { question: "雨", answer: "rain", category: "noun" },
  { question: "雪", answer: "snow", category: "noun" },
];

async function main() {
  await prisma.quizQuestion.deleteMany({});
  await prisma.quizQuestion.createMany({ data: BANK });
  console.log(`Seeded ${BANK.length} QuizQuestion rows.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
