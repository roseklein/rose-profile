export default async (req, context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();

    // Call Anthropic API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    const replyText = data.content?.[0]?.text || "";

    // Extract user question from last message
    const messages = body.messages || [];
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    const question = lastUserMsg?.content || "";
    const exchangeNum = messages.filter(m => m.role === "user").length;

    // Log to Notion asynchronously (don't block the response)
    const notionKey = process.env.NOTION_API_KEY;
    const dbId = "a026823104f345419cba1c35f935d3fa";

    if (notionKey && question) {
      fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${notionKey}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
          parent: { database_id: dbId },
          properties: {
            Question: {
              title: [{ text: { content: question.slice(0, 200) } }]
            },
            Response: {
              rich_text: [{ text: { content: replyText.slice(0, 2000) } }]
            },
            "Exchange #": {
              number: exchangeNum
            }
          }
        })
      }).catch(() => {}); // Silent fail — never block the chat
    }

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = { path: "/api/chat" };
