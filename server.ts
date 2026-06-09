import bodyParser from 'body-parser'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { assert, type Infer } from 'superstruct'
import { RequestBodyStruct, ResponseStruct } from './struct'

// 💡 import 대신 CommonJS require 방식을 사용하여 Bun 런타임에서 hanspell 모듈을 안정적으로 가져옵니다.
const hanspell = require('hanspell')

const app = express()

// 💡 Render 프록시 환경에서 유저 IP를 정상 식별하고 rateLimit이 정상 작동하도록 설정
app.set('trust proxy', 1) 

app.use(cors())
app.use(bodyParser.json())

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 테스트 및 실제 사용 편의를 위해 제한을 20으로 살짝 상향
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
Speller API (Daum Engine v2)<br />
<a href="https://github.com/Yesususu77/speller-api">https://github.com/Yesususu77/speller-api</a>
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
    // 💡 hanspell 콜백을 Promise로 감싸서 async/await 흐름과 일치시킵니다.
    const suggestions = await new Promise((resolve, reject) => {
      
      // 💡 차단 없는 Daum 맞춤법 엔진 호출
      hanspell.spellCheckByDAUM(
        text,
        6000,
        (result: any) => {
          if (!result || result.length === 0) {
            return resolve([])
          }

          // 질문자님의 원래 프론트엔드 응답 규격(ResponseStruct)에 맞게 1:1 매핑
          const mapped = result.map((item: any) => ({
            description: item.info?.replace(/<br\s*\/?>/gi, '\n') ?? '맞춤법 오류 가능성이 있습니다.',
            start: 0, // 기존 struct 형식 호환용 기본값
            end: 0,   // 기존 struct 형식 호환용 기본값
            text: item.token,                  // 틀린 단어
            candidates: item.suggestions ?? [], // 추천 단어 배열
          }))
          resolve(mapped)
        },
        (err: any) => {
          reject(err)
        }
      )
    })

    // 최종 데이터 반환 (기존 ResponseStruct 규격 검증 만족)
    return res.status(200).json({
      suggestions: suggestions,
    } satisfies Infer<typeof ResponseStruct>)

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
