// src/app/api/chat-stream/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'edge'; // ✅ Vercel 기준 streaming엔 edge runtime 필수

export async function POST(req: Request) {
  const { messages } = await req.json();

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          stream: true,
          messages,
        }),
      });

      const reader = res.body?.getReader();
      if (!reader) {
        controller.error('Failed to read GPT stream');
        return;
      }

      const read = async () => {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }

        const chunk = decoder.decode(value);
        const lines = chunk
          .split('\n')
          .filter(line => line.trim().startsWith('data: '))
          .map(line => line.replace('data: ', ''));

        for (const line of lines) {
          if (line === '[DONE]') {
            controller.close();
            return;
          }

          try {
            const json = JSON.parse(line);
            const text = json.choices?.[0]?.delta?.content;
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          } catch (err) {
            controller.error(err);
          }
        }

        await read();
      };

      await read();
    },
  });

  return new NextResponse(stream);
}
