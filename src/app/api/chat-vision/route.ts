// src/api/chat-vision/route.ts

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { messages, model } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: model || 'gpt-4o',
      messages: messages,
      max_tokens: 1024, // 이미지 설명은 길어질 수 있으므로 토큰 제한 설정
    });

    const reply = completion.choices[0]?.message?.content || '응답이 없습니다.';
    return NextResponse.json({ reply });

  } catch (error: any) {
    console.error('❌ GPT Vision API 오류:', error);
    return new NextResponse(
      JSON.stringify({
        error: 'GPT Vision 서버 오류',
        message: error?.error?.message || error?.message || 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}