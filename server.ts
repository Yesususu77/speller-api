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
    console.error('검증 에러 (Request Body Mismatch):', e)
    return res.status(400).send('Invalid request body')
  }

  const text = body.text

  try {
    // 💡 hanspell 콜백을 Promise로 감싸서 처리
    const suggestions = await new Promise((resolve, reject) => {
      
      // 🔥 [여기 중요!] spellCheckByPNU 대신 spellCheckByDAUM을 호출합니다.
      hanspell.spellCheckByDAUM(
        text,
        6000,
        (result: any) => {
          if (!result || result.length === 0) {
            return resolve([])
          }

          // 질문자님의 원래 프론트엔드 형식에 맞게 변환
          const mapped = result.map((item: any) => ({
            description: item.info?.replace(/<br\s*\/?>/gi, '\n') ?? '맞춤법 오류 가능성이 있습니다.',
            start: 0, 
            end: 0,
            text: item.token,                 // 틀린 단어
            candidates: item.suggestions ?? [], // 추천 단어 배열
          }))
          resolve(mapped)
        },
        (err: any) => {
          reject(err)
        }
      )
    })

    return res.status(200).json({ suggestions })

  } catch (e) {
    console.error('맞춤법 엔진 내부 에러 상세:', e)
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
