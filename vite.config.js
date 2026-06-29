import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 프론트엔드(React) 빌드 설정. dev 서버는 5173, 소켓 백엔드는 3000(별도).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: 'dist' },
})
