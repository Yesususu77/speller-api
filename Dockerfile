# 1. 공식 Bun 이미지를 기반으로 시작합니다
FROM oven/bun:latest

# 2. 서버 코드가 들어갈 작업 디렉토리 설정
WORKDIR /app

# 3. 의존성 파일들을 먼저 복사합니다
COPY package.json bun.lockb* ./

# 4. 필요한 패키지들을 설치합니다
RUN bun install

# 5. 나머지 모든 소스코드를 복사합니다
COPY . .

# 6. 포트 설정 (렌더와 통신할 포트)
EXPOSE 3000

# 7. 서버 실행 명령어 (깃허브 가이드에 있던 bun start)
CMD ["bun", "start"]
