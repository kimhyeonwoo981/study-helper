// src/api/chat-stream/route.ts

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        stream: true,
        messages,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.json();
      throw new Error(errorBody.error.message || 'OpenAI API 요청에 실패했습니다.');
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            break;
          }
          const chunk = decoder.decode(value);
          const lines = chunk
            .split('\n')
            .filter((line) => line.trim().startsWith('data: '))
            .map((line) => line.replace('data: ', ''));

          for (const line of lines) {
            if (line === '[DONE]') {
              controller.close();
              return;
            }
            try {
              const json = JSON.parse(line);
              const text = json.choices[0]?.delta?.content;
              if (text) {
                controller.enqueue(new TextEncoder().encode(text));
              }
            } catch (e) {}
          }
        }
      },
    });

    return new Response(stream);

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}