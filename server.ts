import bodyParser from 'body-parser'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { assert, type Infer } from 'superstruct'
import { RequestBodyStruct, ResponseStruct } from './struct'

// 💡 현재 정상 작동하는 최신 부산대 검사 통신 API 엔드포인트로 변경
const spellerUrl = 'https://nara-speller.co.kr/speller/results'

const app = express()

app.set('trust proxy', 1) 

app.use(cors())
app.use(bodyParser.json())

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many requests, please try again after a minute',
})

app.get('/', (req, res) => {
  res.send(
    `
<!DOCTYPE html>
<html>
<head>
  <title>Speller API</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: sans-serif; }
  </style>
</head>
<body>
Speller API<br />
<a href="https://github.com/jhaemin/speller-api">https://github.com/jhaemin/speller-api</a>
</body>
</html>
`
  )
})

app.post('/', limiter, async (req, res) => {
  const body = req.body

  try {
    assert(body, RequestBodyStruct)
  } catch (e) {
    return res.status(400).send('Invalid request body')
  }

  const text = body.text.split('\n').join('\r\n')

  try {
    // 💡 최신 부산대 개편 보안 우회를 위한 필수 헤더 정보 세팅
    const spellerRes = await fetch(spellerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://nara-speller.co.kr/speller/'
      },
      body: `text1=${encodeURIComponent(text)}`,
    })

    if (!spellerRes.ok) {
      throw new Error(`부산대 서버 응답 실패: ${spellerRes.status}`)
    }

    const result = await spellerRes.text()

    // 💡 개편된 부산대 결과 페이지의 새로운 자바스크립트 변수 패턴 파싱
    // 최근 개편으로 data = [ ... ] 구조가 변했거나 다르게 직렬화되는 문제를 방어합니다.
    const dataMatch = result.match(/data\s*=\s*(\[[ \t]*\{[\s\S]*?\}]);/);
    const dataString = dataMatch?.[1] ?? ''

    if (!dataString) {
      return res.status(200).json({
        suggestions: [],
      })
    }

    // JSON 파싱 후 데이터 추출
    const rawData = JSON.parse(dataString)[0]
    const errInfo = (rawData.errInfo ?? [])
      .filter((err: any) => err.candWord)
      .map((err: any) => ({
        description: err.help?.replace(/<br\s*\/?>/gi, '\n') ?? '', // 도움말 태그 깔끔하게 정리
        start: err.start,
        end: err.end,
        text: err.orgStr,
        candidates: err.candWord.split('|').map((w: string) => w.trim()), // 공백 제거
      }))

    return res.status(200).json({
      suggestions: errInfo,
    } satisfies Infer<typeof ResponseStruct>)

  } catch (e) {
    console.error('맞춤법 검사 엔진 내부 에러:', e)
    return res.status(500).send('Internal Server Error')
  }
})

if (Bun.env.PORT === undefined) {
  console.warn('PORT is not defined in .env file. Using default port 3000')
}

const port = Bun.env.PORT ?? 3000

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
