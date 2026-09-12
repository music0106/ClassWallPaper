// ===================================================
// Gemini에게 물어보는 Vercel 서버리스 함수
//
// 왜 서버가 필요한가요?
//   API 키를 브라우저 코드(app.js)에 적으면 누구나 볼 수 있습니다.
//   그래서 키는 서버에만 두고, 브라우저는 이 주소(/api/gemini)로 부탁만 합니다.
//
// 왜 Firebase Functions가 아니라 여기인가요?
//   Firebase Functions는 유료 요금제(Blaze)라야 씁니다.
//   이 프로젝트는 무료 요금제(Spark)로 진행하므로,
//   서버가 필요한 일은 Vercel의 무료 함수로 처리합니다.
//
// 이 파일의 규칙
//   api 폴더 안의 파일은 Vercel에서 자동으로 서버 주소가 됩니다.
//   이 파일은 /api/gemini 주소가 됩니다.
//   API 키는 Vercel 환경변수(GEMINI_API_KEY)에 넣고 process.env로 꺼내 씁니다.
// ===================================================

export default async function handler(req, res) {
  // CORS 헤더 설정 (브라우저에서 호출 가능하도록 지원)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-gemini-api-key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 지원합니다." });
  }

  const { text } = req.body || {};
  if (!text) {
    return res.status(400).json({ error: "메모 내용(text)이 필요합니다." });
  }

  // Vercel 환경변수에서 Gemini API 키를 가져옵니다.
  const apiKey = process.env.GEMINI_API_KEY || req.headers["x-gemini-api-key"] || req.body?.apiKey;

  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY가 설정되지 않았습니다. Vercel 환경변수(GEMINI_API_KEY)를 등록해 주세요."
    });
  }

  // 개인정보 보호(AGENTS.md): uid나 이메일 등 식별 정보를 제외하고 순수 메모 텍스트만 전달
  const systemPrompt = "당신은 따뜻하고 학생을 깊이 격려해 주는 친절한 학교 선생님입니다. 학생이 작성한 담벼락 메모를 읽고, 긍정적인 피드백과 칭찬을 담아 다정한 어조로 1~2문장의 짧은 코멘트를 남겨주세요.";
  const userPrompt = `학생이 쓴 글: "${text}"\n\n위 내용에 대해 다정하고 친절한 어조로 1~2문장의 짧은 응원/칭찬 코멘트를 작성해 주세요.`;

  // 무료 티어로 제공되는 Gemini 1.5 Flash 모델
  const MODEL_NAME = "gemini-1.5-flash";
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\n${userPrompt}` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 150
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", errorText);
      return res.status(response.status).json({
        error: `Gemini API 호출에 실패했습니다 (${response.status}): ${errorText}`
      });
    }

    const data = await response.json();
    const comment = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "참 좋은 생각을 적어주었네요! 힘내요! 👍";

    return res.status(200).json({ comment });
  } catch (err) {
    console.error("Gemini 서버 처리 오류:", err);
    return res.status(500).json({ error: "Gemini 서버 처리 중 오류가 발생했습니다: " + err.message });
  }
}
