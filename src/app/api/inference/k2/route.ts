export const runtime = "nodejs";

interface K2Message {
  role: "system" | "user" | "assistant";
  content: string;
}

const K2_API_URL = "https://api.k2think.ai/v1/chat/completions";
const K2_MODEL = "MBZUAI-IFM/K2-Think-v2";

export async function POST(request: Request) {
  const apiKey = process.env.K2_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "K2_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  const body = (await request.json()) as {
    messages?: K2Message[];
  };

  if (!body.messages?.length) {
    return Response.json({ error: "messages are required" }, { status: 400 });
  }

  const upstream = await fetch(K2_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: K2_MODEL,
      messages: body.messages,
      stream: false,
    }),
  });

  const data = await upstream.json();

  if (!upstream.ok) {
    return Response.json(
      { error: data?.error ?? "K2 request failed", details: data },
      { status: upstream.status }
    );
  }

  const content =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.delta?.content ??
    "";

  return Response.json({
    model: data?.model ?? K2_MODEL,
    content,
    raw: data,
  });
}
