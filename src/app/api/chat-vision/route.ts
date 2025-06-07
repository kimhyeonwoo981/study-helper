import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // 반드시 .env.local에 설정
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, model } = body;

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'messages 형식이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: model || 'gpt-4o', // Vision 기능 포함된 모델
      messages: messages,
    });

    const reply = completion.choices[0]?.message?.content || '응답이 없습니다.';
    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('❌ GPT Vision API 오류:', error);

    return new NextResponse(
      JSON.stringify({
        error: 'GPT Vision 서버 오류',
        message: error?.message || 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
